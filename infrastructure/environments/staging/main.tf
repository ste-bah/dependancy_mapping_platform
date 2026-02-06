#------------------------------------------------------------------------------
# Code Reviewer - Staging Environment
# Root module composing all infrastructure modules
#------------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

#------------------------------------------------------------------------------
# Provider Configuration
#------------------------------------------------------------------------------

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

#------------------------------------------------------------------------------
# Local Values
#------------------------------------------------------------------------------

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Staging defaults - production-like but cost-conscious
  enable_nat_gateway = true
  single_nat_gateway = true # Single NAT to save costs in staging
}

#------------------------------------------------------------------------------
# Module 1: Secrets Manager
# No dependencies - creates secrets for other modules to reference
#------------------------------------------------------------------------------

module "secrets" {
  source = "../../modules/secrets"

  project_name            = var.project_name
  environment             = var.environment
  recovery_window_in_days = 7 # Standard recovery window

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 2: S3 Buckets
# No dependencies - creates storage buckets
#------------------------------------------------------------------------------

module "s3" {
  source = "../../modules/s3"

  project_name  = var.project_name
  environment   = var.environment
  force_destroy = false # Protect data in staging

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 3: VPC
# No dependencies - creates networking foundation
#------------------------------------------------------------------------------

module "vpc" {
  source = "../../modules/vpc"

  project_name          = var.project_name
  environment           = var.environment
  vpc_cidr              = var.vpc_cidr
  azs                   = var.availability_zones
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs

  enable_nat_gateway = local.enable_nat_gateway
  single_nat_gateway = local.single_nat_gateway # Single NAT for staging cost savings
  enable_flow_logs   = true                     # Enable for production-like monitoring

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 4: Security Groups
# Depends on: VPC
#------------------------------------------------------------------------------

module "security_groups" {
  source = "../../modules/security-groups"

  project_name   = var.project_name
  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  vpc_cidr_block = module.vpc.vpc_cidr_block

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 5: IAM Roles
# Depends on: Secrets, S3 (needs ARNs for policies)
#------------------------------------------------------------------------------

module "iam" {
  source = "../../modules/iam"

  project_name   = var.project_name
  environment    = var.environment
  log_group_arn  = "arn:aws:logs:${var.aws_region}:*:log-group:/ecs/${var.project_name}-${var.environment}/*"
  secret_arns    = module.secrets.secret_arns_list
  s3_bucket_arns = concat(module.s3.all_bucket_arns, module.s3.bucket_arns_with_objects)

  enable_ecs_exec = true # Keep debugging enabled in staging
  enable_xray     = true # Enable tracing in staging

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 6: RDS PostgreSQL
# Depends on: VPC, Security Groups, Secrets
#------------------------------------------------------------------------------

module "rds" {
  source = "../../modules/rds"

  project_name           = var.project_name
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  db_subnet_group_name   = module.vpc.db_subnet_group_name
  security_group_id      = module.security_groups.rds_security_group_id
  db_password_secret_arn = module.secrets.db_password_secret_arn

  # Staging sizing - medium instances
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage

  # High availability - enabled for production-like testing
  multi_az = true

  # Backup configuration
  backup_retention_period = 7

  # Protection settings - disabled for easier rebuilds
  deletion_protection = false

  # Monitoring - enabled for production-like monitoring
  create_cloudwatch_alarms = true

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 7: ElastiCache Redis
# Depends on: VPC, Security Groups, Secrets
#------------------------------------------------------------------------------

module "elasticache" {
  source = "../../modules/elasticache"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  subnet_group_name     = module.vpc.elasticache_subnet_group_name
  security_group_id     = module.security_groups.elasticache_security_group_id
  auth_token_secret_arn = module.secrets.redis_password_secret_arn

  # Staging sizing - medium instances
  node_type          = var.elasticache_node_type
  num_cache_clusters = 2 # Two nodes for failover testing

  # High availability - enabled for production-like testing
  automatic_failover_enabled = true

  # Backup configuration
  snapshot_retention_limit = 3
  skip_final_snapshot      = true # Allow faster destroys in staging

  # Monitoring - enabled
  create_cloudwatch_alarms = true

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 8: Application Load Balancer
# Depends on: VPC, Security Groups
#------------------------------------------------------------------------------

module "alb" {
  source = "../../modules/alb"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  security_group_id = module.security_groups.alb_security_group_id
  certificate_arn   = var.certificate_arn

  # Protection settings - disabled for easier rebuilds
  deletion_protection = false

  # Health check configuration
  health_check_path = "/health/live"

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 9: ECS Fargate
# Depends on: All above modules
#------------------------------------------------------------------------------

module "ecs" {
  source = "../../modules/ecs"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  # Container configuration
  container_image = var.container_image

  # Staging sizing - medium instances
  task_cpu    = var.ecs_task_cpu
  task_memory = var.ecs_task_memory

  # Service configuration
  desired_count          = 2    # Two tasks for HA testing
  enable_execute_command = true # Keep debugging enabled

  # Auto scaling - production-like
  min_capacity              = 2
  max_capacity              = 6
  enable_cpu_autoscaling    = true
  enable_memory_autoscaling = true
  cpu_target_value          = 70
  memory_target_value       = 80

  # Network configuration
  private_subnet_ids    = module.vpc.private_subnet_ids
  ecs_security_group_id = module.security_groups.ecs_security_group_id

  # Load balancer configuration
  target_group_arn        = module.alb.target_group_arn
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix

  # IAM configuration
  execution_role_arn = module.iam.task_execution_role_arn
  task_role_arn      = module.iam.task_role_arn

  # Database configuration
  db_host                = module.rds.db_instance_address
  db_port                = module.rds.db_instance_port
  db_name                = module.rds.db_instance_name
  db_username            = module.rds.db_instance_username
  db_password_secret_arn = module.secrets.db_password_secret_arn

  # Redis configuration
  redis_host                = module.elasticache.redis_endpoint
  redis_port                = module.elasticache.redis_port
  redis_password_secret_arn = module.secrets.redis_password_secret_arn

  # JWT configuration
  jwt_private_key_secret_arn = module.secrets.jwt_private_key_secret_arn
  jwt_public_key_secret_arn  = module.secrets.jwt_public_key_secret_arn

  # Session configuration
  session_secret_arn = module.secrets.session_secret_arn

  # GitHub OAuth configuration
  github_client_id_secret_arn     = module.secrets.github_client_id_secret_arn
  github_client_secret_secret_arn = module.secrets.github_client_secret_secret_arn
  github_token_secret_arn         = module.secrets.github_token_secret_arn
  github_callback_url             = var.github_callback_url

  # S3 configuration
  s3_repos_bucket = module.s3.repos_bucket_id
  s3_scans_bucket = module.s3.scans_bucket_id
  s3_temp_bucket  = module.s3.temp_bucket_id

  # Application configuration
  node_env       = "staging"
  log_level      = "info"
  app_url        = var.app_url
  api_url        = var.api_url
  enable_swagger = true # Enable for staging testing
  enable_metrics = true

  # Logging
  log_retention_days = 14

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Module 10: CloudWatch Monitoring
# Depends on: ECS, ALB, RDS, ElastiCache
#------------------------------------------------------------------------------

module "cloudwatch" {
  source = "../../modules/cloudwatch"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  # ECS configuration
  ecs_cluster_name   = module.ecs.cluster_name
  ecs_service_name   = module.ecs.service_name
  ecs_log_group_name = module.ecs.log_group_name

  # ALB configuration
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix

  # RDS configuration
  rds_instance_identifier = module.rds.db_instance_identifier

  # ElastiCache configuration
  elasticache_cluster_id = module.elasticache.redis_replication_group_id

  # Dashboard - enabled
  enable_dashboard = true

  # SNS notifications (optional)
  sns_alarm_topic_arn = var.sns_alarm_topic_arn

  tags = local.common_tags
}
