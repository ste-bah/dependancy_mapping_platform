#------------------------------------------------------------------------------
# AWS ECS Fargate Module - Variables
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Project Identification
#------------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

#------------------------------------------------------------------------------
# Container Configuration
#------------------------------------------------------------------------------

variable "container_image" {
  description = "Docker image for the API container (repository:tag)"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
  default     = 3000
}

variable "container_cpu" {
  description = "CPU units for the container (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "container_memory" {
  description = "Memory for the container in MB"
  type        = number
  default     = 2048
}

variable "container_stop_timeout" {
  description = "Time in seconds before container is forcefully stopped"
  type        = number
  default     = 30
}

#------------------------------------------------------------------------------
# Task Configuration
#------------------------------------------------------------------------------

variable "task_cpu" {
  description = "CPU units for the ECS task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096, 8192, 16384], var.task_cpu)
    error_message = "Task CPU must be a valid Fargate CPU value."
  }
}

variable "task_memory" {
  description = "Memory for the ECS task in MB"
  type        = number
  default     = 2048
  validation {
    condition     = var.task_memory >= 512 && var.task_memory <= 122880
    error_message = "Task memory must be between 512 MB and 122880 MB."
  }
}

variable "cpu_architecture" {
  description = "CPU architecture for the task (X86_64 or ARM64)"
  type        = string
  default     = "X86_64"
  validation {
    condition     = contains(["X86_64", "ARM64"], var.cpu_architecture)
    error_message = "CPU architecture must be X86_64 or ARM64."
  }
}

#------------------------------------------------------------------------------
# Service Configuration
#------------------------------------------------------------------------------

variable "desired_count" {
  description = "Desired number of tasks running"
  type        = number
  default     = 2
}

variable "platform_version" {
  description = "Fargate platform version"
  type        = string
  default     = "LATEST"
}

variable "health_check_grace_period" {
  description = "Seconds to wait before checking ECS task health"
  type        = number
  default     = 60
}

variable "enable_execute_command" {
  description = "Enable ECS Exec for debugging containers"
  type        = bool
  default     = true
}

variable "force_new_deployment" {
  description = "Force new deployment on apply"
  type        = bool
  default     = false
}

#------------------------------------------------------------------------------
# Deployment Configuration
#------------------------------------------------------------------------------

variable "deployment_minimum_healthy_percent" {
  description = "Minimum healthy percent during deployment"
  type        = number
  default     = 100
}

variable "deployment_maximum_percent" {
  description = "Maximum percent during deployment"
  type        = number
  default     = 200
}

variable "enable_deployment_circuit_breaker" {
  description = "Enable deployment circuit breaker"
  type        = bool
  default     = true
}

variable "enable_deployment_rollback" {
  description = "Enable automatic rollback on deployment failure"
  type        = bool
  default     = true
}

#------------------------------------------------------------------------------
# Capacity Provider Configuration
#------------------------------------------------------------------------------

variable "enable_fargate_spot" {
  description = "Enable Fargate Spot capacity provider"
  type        = bool
  default     = false
}

variable "fargate_base_count" {
  description = "Base count for Fargate capacity provider"
  type        = number
  default     = 2
}

variable "fargate_weight" {
  description = "Weight for Fargate capacity provider"
  type        = number
  default     = 100
}

variable "fargate_spot_weight" {
  description = "Weight for Fargate Spot capacity provider"
  type        = number
  default     = 0
}

#------------------------------------------------------------------------------
# Auto Scaling Configuration
#------------------------------------------------------------------------------

variable "min_capacity" {
  description = "Minimum number of tasks for auto scaling"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum number of tasks for auto scaling"
  type        = number
  default     = 10
}

variable "enable_cpu_autoscaling" {
  description = "Enable CPU-based auto scaling"
  type        = bool
  default     = true
}

variable "cpu_target_value" {
  description = "Target CPU utilization percentage for auto scaling"
  type        = number
  default     = 70
}

variable "enable_memory_autoscaling" {
  description = "Enable memory-based auto scaling"
  type        = bool
  default     = true
}

variable "memory_target_value" {
  description = "Target memory utilization percentage for auto scaling"
  type        = number
  default     = 80
}

variable "enable_request_autoscaling" {
  description = "Enable request count-based auto scaling"
  type        = bool
  default     = false
}

variable "request_count_target_value" {
  description = "Target request count per target for auto scaling"
  type        = number
  default     = 1000
}

variable "scale_in_cooldown" {
  description = "Cooldown period in seconds before scaling in"
  type        = number
  default     = 300
}

variable "scale_out_cooldown" {
  description = "Cooldown period in seconds before scaling out"
  type        = number
  default     = 60
}

#------------------------------------------------------------------------------
# Scheduled Scaling Configuration
#------------------------------------------------------------------------------

variable "enable_scheduled_scaling" {
  description = "Enable scheduled scaling actions"
  type        = bool
  default     = false
}

variable "scale_down_schedule" {
  description = "Cron expression for scaling down (e.g., off-hours)"
  type        = string
  default     = "cron(0 22 ? * MON-FRI *)"
}

variable "scale_up_schedule" {
  description = "Cron expression for scaling up (e.g., business hours)"
  type        = string
  default     = "cron(0 6 ? * MON-FRI *)"
}

variable "schedule_timezone" {
  description = "Timezone for scheduled scaling"
  type        = string
  default     = "America/New_York"
}

variable "scheduled_min_capacity" {
  description = "Minimum capacity during scheduled scale-down"
  type        = number
  default     = 1
}

variable "scheduled_max_capacity" {
  description = "Maximum capacity during scheduled scale-down"
  type        = number
  default     = 2
}

#------------------------------------------------------------------------------
# Health Check Configuration
#------------------------------------------------------------------------------

variable "health_check_path" {
  description = "Path for container health check"
  type        = string
  default     = "/health/live"
}

variable "health_check_interval" {
  description = "Interval between health checks in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_retries" {
  description = "Number of health check retries before marking unhealthy"
  type        = number
  default     = 3
}

variable "health_check_start_period" {
  description = "Grace period before health checks start in seconds"
  type        = number
  default     = 60
}

#------------------------------------------------------------------------------
# Container Insights and Logging
#------------------------------------------------------------------------------

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
  validation {
    condition = contains([
      0, 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653
    ], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention value."
  }
}

#------------------------------------------------------------------------------
# Service Connect Configuration
#------------------------------------------------------------------------------

variable "enable_service_connect" {
  description = "Enable ECS Service Connect for service mesh"
  type        = bool
  default     = false
}

variable "service_connect_namespace" {
  description = "Cloud Map namespace for Service Connect"
  type        = string
  default     = ""
}

#------------------------------------------------------------------------------
# Network Configuration
#------------------------------------------------------------------------------

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

#------------------------------------------------------------------------------
# Load Balancer Configuration
#------------------------------------------------------------------------------

variable "target_group_arn" {
  description = "ARN of the ALB target group"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ARN suffix of the ALB (for request-based autoscaling)"
  type        = string
  default     = ""
}

variable "target_group_arn_suffix" {
  description = "ARN suffix of the target group (for request-based autoscaling)"
  type        = string
  default     = ""
}

#------------------------------------------------------------------------------
# IAM Configuration
#------------------------------------------------------------------------------

variable "execution_role_arn" {
  description = "ARN of the ECS task execution IAM role"
  type        = string
}

variable "task_role_arn" {
  description = "ARN of the ECS task IAM role"
  type        = string
}

#------------------------------------------------------------------------------
# Database Configuration
#------------------------------------------------------------------------------

variable "db_host" {
  description = "PostgreSQL database host"
  type        = string
}

variable "db_port" {
  description = "PostgreSQL database port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
}

variable "db_username" {
  description = "PostgreSQL database username"
  type        = string
}

variable "db_ssl" {
  description = "Enable SSL for database connections"
  type        = bool
  default     = true
}

variable "db_password_secret_arn" {
  description = "ARN of Secrets Manager secret containing DB password"
  type        = string
}

#------------------------------------------------------------------------------
# Redis Configuration
#------------------------------------------------------------------------------

variable "redis_host" {
  description = "Redis host endpoint"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_tls" {
  description = "Enable TLS for Redis connections"
  type        = bool
  default     = true
}

variable "redis_password_secret_arn" {
  description = "ARN of Secrets Manager secret containing Redis password"
  type        = string
}

#------------------------------------------------------------------------------
# JWT Configuration
#------------------------------------------------------------------------------

variable "jwt_private_key_secret_arn" {
  description = "ARN of Secrets Manager secret containing JWT private key"
  type        = string
}

variable "jwt_public_key_secret_arn" {
  description = "ARN of Secrets Manager secret containing JWT public key"
  type        = string
}

#------------------------------------------------------------------------------
# Session Configuration
#------------------------------------------------------------------------------

variable "session_secret_arn" {
  description = "ARN of Secrets Manager secret containing session secret"
  type        = string
}

#------------------------------------------------------------------------------
# GitHub OAuth Configuration
#------------------------------------------------------------------------------

variable "github_client_id_secret_arn" {
  description = "ARN of Secrets Manager secret containing GitHub OAuth client ID"
  type        = string
}

variable "github_client_secret_secret_arn" {
  description = "ARN of Secrets Manager secret containing GitHub OAuth client secret"
  type        = string
}

variable "github_token_secret_arn" {
  description = "ARN of Secrets Manager secret containing GitHub PAT"
  type        = string
}

variable "github_callback_url" {
  description = "GitHub OAuth callback URL"
  type        = string
}

#------------------------------------------------------------------------------
# S3 Configuration
#------------------------------------------------------------------------------

variable "s3_repos_bucket" {
  description = "S3 bucket name for repository storage"
  type        = string
}

variable "s3_scans_bucket" {
  description = "S3 bucket name for scan results storage"
  type        = string
}

variable "s3_temp_bucket" {
  description = "S3 bucket name for temporary storage"
  type        = string
}

#------------------------------------------------------------------------------
# Application Configuration
#------------------------------------------------------------------------------

variable "node_env" {
  description = "Node.js environment (development, production)"
  type        = string
  default     = "production"
}

variable "log_level" {
  description = "Application log level (debug, info, warn, error)"
  type        = string
  default     = "info"
  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.log_level)
    error_message = "Log level must be debug, info, warn, or error."
  }
}

variable "app_url" {
  description = "Frontend application URL"
  type        = string
}

variable "api_url" {
  description = "API URL (used for CORS and redirects)"
  type        = string
}

variable "enable_swagger" {
  description = "Enable Swagger API documentation"
  type        = bool
  default     = false
}

variable "enable_metrics" {
  description = "Enable Prometheus metrics endpoint"
  type        = bool
  default     = true
}
