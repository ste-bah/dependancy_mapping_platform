#------------------------------------------------------------------------------
# Variables for RDS PostgreSQL Module
# Required inputs from VPC, Security Groups, and Secrets modules
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Project Configuration
#------------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project, used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

#------------------------------------------------------------------------------
# Network Configuration (from VPC module)
#------------------------------------------------------------------------------

variable "vpc_id" {
  description = "ID of the VPC where RDS will be deployed"
  type        = string
}

variable "db_subnet_group_name" {
  description = "Name of the DB subnet group from VPC module"
  type        = string
}

variable "security_group_id" {
  description = "ID of the RDS security group from Security Groups module"
  type        = string
}

#------------------------------------------------------------------------------
# Database Configuration
#------------------------------------------------------------------------------

variable "db_name" {
  description = "Name of the database to create"
  type        = string
  default     = "code_reviewer"
}

variable "db_username" {
  description = "Master username for the database"
  type        = string
  default     = "app_admin"
}

variable "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the database password"
  type        = string
}

#------------------------------------------------------------------------------
# Engine Configuration
#------------------------------------------------------------------------------

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

#------------------------------------------------------------------------------
# Storage Configuration
#------------------------------------------------------------------------------

variable "allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 100
}

variable "max_allocated_storage" {
  description = "Maximum storage for autoscaling in GB"
  type        = number
  default     = 500
}

variable "kms_key_id" {
  description = "KMS key ID for storage encryption and Performance Insights (optional, uses AWS managed key if not specified)"
  type        = string
  default     = null
}

#------------------------------------------------------------------------------
# High Availability
#------------------------------------------------------------------------------

variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

#------------------------------------------------------------------------------
# Backup Configuration
#------------------------------------------------------------------------------

variable "backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Daily time range during which automated backups are created (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Weekly time range during which maintenance can occur (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

#------------------------------------------------------------------------------
# Monitoring Configuration
#------------------------------------------------------------------------------

variable "performance_insights_retention_period" {
  description = "Retention period for Performance Insights data in days (7 or 731)"
  type        = number
  default     = 7
}

variable "enhanced_monitoring_interval" {
  description = "Interval in seconds for Enhanced Monitoring metrics (0, 1, 5, 10, 15, 30, 60)"
  type        = number
  default     = 60
}

variable "monitoring_role_arn" {
  description = "ARN of the IAM role for Enhanced Monitoring (optional)"
  type        = string
  default     = null
}

#------------------------------------------------------------------------------
# Protection Settings
#------------------------------------------------------------------------------

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

variable "iam_database_authentication_enabled" {
  description = "Enable IAM database authentication"
  type        = bool
  default     = false
}

#------------------------------------------------------------------------------
# CloudWatch Alarms Configuration
#------------------------------------------------------------------------------

variable "create_cloudwatch_alarms" {
  description = "Create CloudWatch alarms for RDS monitoring"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarms trigger (SNS topics)"
  type        = list(string)
  default     = []
}

variable "cpu_utilization_threshold" {
  description = "CPU utilization percentage threshold for alarm"
  type        = number
  default     = 80
}

variable "free_storage_threshold_bytes" {
  description = "Free storage space threshold in bytes for alarm"
  type        = number
  default     = 10737418240 # 10 GB
}

variable "max_connections_threshold" {
  description = "Maximum database connections threshold for alarm"
  type        = number
  default     = 100
}

variable "freeable_memory_threshold_bytes" {
  description = "Freeable memory threshold in bytes for alarm"
  type        = number
  default     = 268435456 # 256 MB
}

variable "read_latency_threshold_seconds" {
  description = "Read latency threshold in seconds for alarm"
  type        = number
  default     = 0.02 # 20ms
}

variable "write_latency_threshold_seconds" {
  description = "Write latency threshold in seconds for alarm"
  type        = number
  default     = 0.05 # 50ms
}

#------------------------------------------------------------------------------
# Tags
#------------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
