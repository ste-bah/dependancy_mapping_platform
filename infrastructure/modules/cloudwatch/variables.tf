#------------------------------------------------------------------------------
# AWS CloudWatch Monitoring Module - Variables
# Input variables for configuring monitoring thresholds and resources
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# General Configuration
#------------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project (used in resource naming)"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region for CloudWatch dashboard metrics"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

#------------------------------------------------------------------------------
# ECS Configuration
#------------------------------------------------------------------------------

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster to monitor"
  type        = string
}

variable "ecs_service_name" {
  description = "Name of the ECS service to monitor"
  type        = string
}

variable "ecs_log_group_name" {
  description = "Name of the ECS log group for application-level metric filters (optional)"
  type        = string
  default     = ""
}

variable "ecs_cpu_threshold" {
  description = "CPU utilization threshold percentage for ECS alarm"
  type        = number
  default     = 80

  validation {
    condition     = var.ecs_cpu_threshold >= 0 && var.ecs_cpu_threshold <= 100
    error_message = "ECS CPU threshold must be between 0 and 100."
  }
}

variable "ecs_memory_threshold" {
  description = "Memory utilization threshold percentage for ECS alarm"
  type        = number
  default     = 85

  validation {
    condition     = var.ecs_memory_threshold >= 0 && var.ecs_memory_threshold <= 100
    error_message = "ECS memory threshold must be between 0 and 100."
  }
}

variable "ecs_min_task_count" {
  description = "Minimum number of running ECS tasks (alarm triggers if below this)"
  type        = number
  default     = 1

  validation {
    condition     = var.ecs_min_task_count >= 0
    error_message = "ECS minimum task count must be non-negative."
  }
}

#------------------------------------------------------------------------------
# ALB Configuration
#------------------------------------------------------------------------------

variable "alb_arn_suffix" {
  description = "ARN suffix of the Application Load Balancer (for CloudWatch dimensions)"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "ARN suffix of the target group (for CloudWatch dimensions)"
  type        = string
}

variable "alb_response_time_threshold" {
  description = "Target response time threshold in seconds (p95)"
  type        = number
  default     = 5

  validation {
    condition     = var.alb_response_time_threshold > 0
    error_message = "ALB response time threshold must be positive."
  }
}

variable "alb_5xx_error_threshold" {
  description = "HTTP 5XX error count threshold per minute"
  type        = number
  default     = 10

  validation {
    condition     = var.alb_5xx_error_threshold >= 0
    error_message = "ALB 5XX error threshold must be non-negative."
  }
}

variable "alb_4xx_error_threshold" {
  description = "HTTP 4XX error count threshold per 5 minutes"
  type        = number
  default     = 100

  validation {
    condition     = var.alb_4xx_error_threshold >= 0
    error_message = "ALB 4XX error threshold must be non-negative."
  }
}

#------------------------------------------------------------------------------
# RDS Configuration
#------------------------------------------------------------------------------

variable "rds_instance_identifier" {
  description = "Identifier of the RDS instance to monitor"
  type        = string
}

variable "rds_cpu_threshold" {
  description = "CPU utilization threshold percentage for RDS alarm"
  type        = number
  default     = 80

  validation {
    condition     = var.rds_cpu_threshold >= 0 && var.rds_cpu_threshold <= 100
    error_message = "RDS CPU threshold must be between 0 and 100."
  }
}

variable "rds_free_storage_threshold_bytes" {
  description = "Free storage space threshold in bytes (default: 10GB)"
  type        = number
  default     = 10737418240 # 10 GB in bytes

  validation {
    condition     = var.rds_free_storage_threshold_bytes > 0
    error_message = "RDS free storage threshold must be positive."
  }
}

variable "rds_connections_threshold" {
  description = "Database connections threshold for RDS alarm"
  type        = number
  default     = 100

  validation {
    condition     = var.rds_connections_threshold > 0
    error_message = "RDS connections threshold must be positive."
  }
}

variable "rds_freeable_memory_threshold_bytes" {
  description = "Freeable memory threshold in bytes (default: 256MB)"
  type        = number
  default     = 268435456 # 256 MB in bytes

  validation {
    condition     = var.rds_freeable_memory_threshold_bytes > 0
    error_message = "RDS freeable memory threshold must be positive."
  }
}

variable "rds_read_latency_threshold" {
  description = "Read latency threshold in seconds for RDS alarm"
  type        = number
  default     = 0.02 # 20ms

  validation {
    condition     = var.rds_read_latency_threshold > 0
    error_message = "RDS read latency threshold must be positive."
  }
}

variable "rds_write_latency_threshold" {
  description = "Write latency threshold in seconds for RDS alarm"
  type        = number
  default     = 0.05 # 50ms

  validation {
    condition     = var.rds_write_latency_threshold > 0
    error_message = "RDS write latency threshold must be positive."
  }
}

#------------------------------------------------------------------------------
# ElastiCache Configuration
#------------------------------------------------------------------------------

variable "elasticache_cluster_id" {
  description = "ID of the ElastiCache cluster to monitor"
  type        = string
}

variable "elasticache_cpu_threshold" {
  description = "CPU utilization threshold percentage for ElastiCache alarm"
  type        = number
  default     = 75

  validation {
    condition     = var.elasticache_cpu_threshold >= 0 && var.elasticache_cpu_threshold <= 100
    error_message = "ElastiCache CPU threshold must be between 0 and 100."
  }
}

variable "elasticache_memory_threshold" {
  description = "Memory usage threshold percentage for ElastiCache alarm"
  type        = number
  default     = 80

  validation {
    condition     = var.elasticache_memory_threshold >= 0 && var.elasticache_memory_threshold <= 100
    error_message = "ElastiCache memory threshold must be between 0 and 100."
  }
}

variable "elasticache_evictions_threshold" {
  description = "Evictions threshold for ElastiCache alarm (0 = any eviction triggers alarm)"
  type        = number
  default     = 0

  validation {
    condition     = var.elasticache_evictions_threshold >= 0
    error_message = "ElastiCache evictions threshold must be non-negative."
  }
}

variable "elasticache_connections_threshold" {
  description = "Connections threshold for ElastiCache alarm"
  type        = number
  default     = 1000

  validation {
    condition     = var.elasticache_connections_threshold > 0
    error_message = "ElastiCache connections threshold must be positive."
  }
}

variable "elasticache_replication_lag_threshold" {
  description = "Replication lag threshold in seconds for ElastiCache alarm"
  type        = number
  default     = 1

  validation {
    condition     = var.elasticache_replication_lag_threshold > 0
    error_message = "ElastiCache replication lag threshold must be positive."
  }
}

#------------------------------------------------------------------------------
# SNS Notification Configuration
#------------------------------------------------------------------------------

variable "sns_alarm_topic_arn" {
  description = "ARN of SNS topic for alarm notifications (empty = no notifications)"
  type        = string
  default     = ""
}

#------------------------------------------------------------------------------
# Dashboard Configuration
#------------------------------------------------------------------------------

variable "enable_dashboard" {
  description = "Whether to create the CloudWatch dashboard"
  type        = bool
  default     = true
}

#------------------------------------------------------------------------------
# Application-Level Monitoring
#------------------------------------------------------------------------------

variable "application_error_threshold" {
  description = "Application error count threshold (from log metric filter)"
  type        = number
  default     = 10

  validation {
    condition     = var.application_error_threshold >= 0
    error_message = "Application error threshold must be non-negative."
  }
}
