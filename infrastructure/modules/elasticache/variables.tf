#------------------------------------------------------------------------------
# Variables for AWS ElastiCache Redis Module
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Required Variables
#------------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project, used for resource naming"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_id" {
  description = "ID of the VPC where ElastiCache will be deployed"
  type        = string

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be a valid VPC identifier starting with 'vpc-'."
  }
}

variable "subnet_group_name" {
  description = "Name of the ElastiCache subnet group (from VPC module)"
  type        = string
}

variable "security_group_id" {
  description = "ID of the security group for ElastiCache (from security-groups module)"
  type        = string

  validation {
    condition     = can(regex("^sg-", var.security_group_id))
    error_message = "Security group ID must be a valid identifier starting with 'sg-'."
  }
}

variable "auth_token_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the Redis AUTH token"
  type        = string

  validation {
    condition     = can(regex("^arn:aws:secretsmanager:", var.auth_token_secret_arn))
    error_message = "Auth token secret ARN must be a valid Secrets Manager ARN."
  }
}

#------------------------------------------------------------------------------
# Instance Configuration
#------------------------------------------------------------------------------

variable "node_type" {
  description = "ElastiCache node type (e.g., cache.t3.medium, cache.r6g.large)"
  type        = string
  default     = "cache.t3.medium"

  validation {
    condition     = can(regex("^cache\\.", var.node_type))
    error_message = "Node type must be a valid ElastiCache instance type starting with 'cache.'."
  }
}

variable "engine_version" {
  description = "Redis engine version (e.g., 7.0, 7.1)"
  type        = string
  default     = "7.0"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+", var.engine_version))
    error_message = "Engine version must be a valid Redis version number."
  }
}

variable "num_cache_clusters" {
  description = "Number of cache clusters (nodes) in the replication group. Minimum 2 for failover."
  type        = number
  default     = 2

  validation {
    condition     = var.num_cache_clusters >= 1 && var.num_cache_clusters <= 6
    error_message = "Number of cache clusters must be between 1 and 6."
  }
}

#------------------------------------------------------------------------------
# High Availability Configuration
#------------------------------------------------------------------------------

variable "automatic_failover_enabled" {
  description = "Enable automatic failover for Multi-AZ (requires num_cache_clusters >= 2)"
  type        = bool
  default     = true
}

#------------------------------------------------------------------------------
# Backup Configuration
#------------------------------------------------------------------------------

variable "snapshot_retention_limit" {
  description = "Number of days to retain automatic snapshots (0 to disable)"
  type        = number
  default     = 7

  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "snapshot_window" {
  description = "Daily time range for automated snapshots (UTC, e.g., '03:00-05:00')"
  type        = string
  default     = "03:00-05:00"

  validation {
    condition     = can(regex("^[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}$", var.snapshot_window))
    error_message = "Snapshot window must be in format 'HH:MM-HH:MM'."
  }
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when destroying the replication group"
  type        = bool
  default     = false
}

#------------------------------------------------------------------------------
# Maintenance Configuration
#------------------------------------------------------------------------------

variable "maintenance_window" {
  description = "Weekly time range for maintenance (UTC, e.g., 'sun:05:00-sun:07:00')"
  type        = string
  default     = "sun:05:00-sun:07:00"

  validation {
    condition     = can(regex("^[a-z]{3}:[0-9]{2}:[0-9]{2}-[a-z]{3}:[0-9]{2}:[0-9]{2}$", var.maintenance_window))
    error_message = "Maintenance window must be in format 'ddd:HH:MM-ddd:HH:MM'."
  }
}

#------------------------------------------------------------------------------
# Monitoring Configuration
#------------------------------------------------------------------------------

variable "notification_topic_arn" {
  description = "ARN of the SNS topic for ElastiCache notifications"
  type        = string
  default     = null
}

variable "create_cloudwatch_alarms" {
  description = "Whether to create CloudWatch alarms for Redis monitoring"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarm transitions to ALARM state"
  type        = list(string)
  default     = []
}

variable "ok_actions" {
  description = "List of ARNs to notify when alarm transitions to OK state"
  type        = list(string)
  default     = []
}

variable "max_connections_threshold" {
  description = "Threshold for max connections CloudWatch alarm"
  type        = number
  default     = 5000
}

#------------------------------------------------------------------------------
# Tags
#------------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
