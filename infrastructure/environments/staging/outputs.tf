#------------------------------------------------------------------------------
# Code Reviewer - Staging Environment Outputs
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# VPC Outputs
#------------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value       = module.vpc.database_subnet_ids
}

#------------------------------------------------------------------------------
# ALB Outputs
#------------------------------------------------------------------------------

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "Route53 zone ID of the ALB"
  value       = module.alb.alb_zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = module.alb.alb_arn
}

#------------------------------------------------------------------------------
# ECS Outputs
#------------------------------------------------------------------------------

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = module.ecs.cluster_arn
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "ecs_service_arn" {
  description = "ARN of the ECS service"
  value       = module.ecs.service_arn
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = module.ecs.task_definition_arn
}

output "ecs_log_group_name" {
  description = "Name of the ECS CloudWatch log group"
  value       = module.ecs.log_group_name
}

#------------------------------------------------------------------------------
# RDS Outputs
#------------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = module.rds.db_instance_endpoint
}

output "rds_address" {
  description = "RDS instance address (hostname only)"
  value       = module.rds.db_instance_address
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "rds_database_name" {
  description = "Name of the database"
  value       = module.rds.db_instance_name
}

output "rds_instance_identifier" {
  description = "RDS instance identifier"
  value       = module.rds.db_instance_identifier
}

#------------------------------------------------------------------------------
# ElastiCache Outputs
#------------------------------------------------------------------------------

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.elasticache.redis_endpoint
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint (for read scaling)"
  value       = module.elasticache.redis_reader_endpoint
}

output "redis_port" {
  description = "Redis port"
  value       = module.elasticache.redis_port
}

output "redis_connection_url" {
  description = "Redis connection URL (TLS enabled)"
  value       = module.elasticache.redis_connection_url
}

#------------------------------------------------------------------------------
# S3 Outputs
#------------------------------------------------------------------------------

output "s3_repos_bucket" {
  description = "S3 bucket for repository storage"
  value       = module.s3.repos_bucket_id
}

output "s3_scans_bucket" {
  description = "S3 bucket for scan results"
  value       = module.s3.scans_bucket_id
}

output "s3_temp_bucket" {
  description = "S3 bucket for temporary storage"
  value       = module.s3.temp_bucket_id
}

#------------------------------------------------------------------------------
# Secrets Manager Outputs
#------------------------------------------------------------------------------

output "secrets_db_password_arn" {
  description = "ARN of the database password secret"
  value       = module.secrets.db_password_secret_arn
}

output "secrets_redis_password_arn" {
  description = "ARN of the Redis password secret"
  value       = module.secrets.redis_password_secret_arn
}

#------------------------------------------------------------------------------
# IAM Outputs
#------------------------------------------------------------------------------

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = module.iam.task_execution_role_arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = module.iam.task_role_arn
}

#------------------------------------------------------------------------------
# CloudWatch Outputs
#------------------------------------------------------------------------------

output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = module.cloudwatch.dashboard_url
}

output "cloudwatch_alarm_arns" {
  description = "Map of all CloudWatch alarm ARNs"
  value       = module.cloudwatch.alarm_arns
}

#------------------------------------------------------------------------------
# Connection Information
#------------------------------------------------------------------------------

output "ecs_exec_command" {
  description = "Command to connect to ECS container for debugging"
  value       = module.ecs.ecs_exec_command
}

#------------------------------------------------------------------------------
# Summary
#------------------------------------------------------------------------------

output "environment_summary" {
  description = "Summary of the deployed environment"
  value = {
    environment       = var.environment
    aws_region        = var.aws_region
    vpc_id            = module.vpc.vpc_id
    alb_dns_name      = module.alb.alb_dns_name
    ecs_cluster       = module.ecs.cluster_name
    ecs_service       = module.ecs.service_name
    rds_endpoint      = module.rds.db_instance_endpoint
    redis_endpoint    = module.elasticache.redis_endpoint
    dashboard_url     = module.cloudwatch.dashboard_url
    multi_az_enabled  = true
    autoscaling_range = "${module.ecs.autoscaling_min_capacity}-${module.ecs.autoscaling_max_capacity}"
  }
}
