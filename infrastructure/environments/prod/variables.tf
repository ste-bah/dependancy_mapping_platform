#------------------------------------------------------------------------------
# Code Reviewer - Production Environment Variables
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Project Configuration
#------------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "dependency-mapping-platform"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"

  validation {
    condition     = var.environment == "prod"
    error_message = "This is the production environment configuration."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

#------------------------------------------------------------------------------
# VPC Configuration
#------------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.2.0.0/16" # Different CIDR from dev/staging
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"] # 3 AZs for HA
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.2.11.0/24", "10.2.12.0/24", "10.2.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.2.21.0/24", "10.2.22.0/24", "10.2.23.0/24"]
}

#------------------------------------------------------------------------------
# RDS Configuration
#------------------------------------------------------------------------------

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large" # Production-grade instance
}

variable "rds_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "Maximum storage for autoscaling in GB"
  type        = number
  default     = 500
}

#------------------------------------------------------------------------------
# ElastiCache Configuration
#------------------------------------------------------------------------------

variable "elasticache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large" # Production-grade instance
}

#------------------------------------------------------------------------------
# ECS Configuration
#------------------------------------------------------------------------------

variable "ecs_task_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 2048 # 2 vCPU for production
}

variable "ecs_task_memory" {
  description = "Memory for ECS task in MB"
  type        = number
  default     = 4096 # 4 GB for production
}

variable "container_image" {
  description = "Docker image for the API container"
  type        = string
  # No default - must be provided
}

#------------------------------------------------------------------------------
# ALB Configuration
#------------------------------------------------------------------------------

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS"
  type        = string
  # No default - must be provided
}

variable "alb_access_logs_bucket" {
  description = "S3 bucket for ALB access logs (leave empty to disable)"
  type        = string
  default     = ""
}

#------------------------------------------------------------------------------
# Application Configuration
#------------------------------------------------------------------------------

variable "app_url" {
  description = "Frontend application URL"
  type        = string
  # No default - must be provided
}

variable "api_url" {
  description = "API URL for CORS and redirects"
  type        = string
  # No default - must be provided
}

variable "github_callback_url" {
  description = "GitHub OAuth callback URL"
  type        = string
  # No default - must be provided
}

#------------------------------------------------------------------------------
# Notification Configuration
#------------------------------------------------------------------------------

variable "sns_alarm_topic_arn" {
  description = "ARN of SNS topic for alarm notifications (required for production)"
  type        = string
  # No default - should be provided for production alerting
}
