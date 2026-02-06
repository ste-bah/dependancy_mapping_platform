#------------------------------------------------------------------------------
# IAM Module Variables
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Required Variables
#------------------------------------------------------------------------------

variable "project_name" {
  type        = string
  description = "Name of the project, used for resource naming"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, staging, prod)"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "log_group_arn" {
  type        = string
  description = "ARN of the CloudWatch log group for ECS container logs"
}

#------------------------------------------------------------------------------
# Secrets Access
#------------------------------------------------------------------------------

variable "secret_arns" {
  type        = list(string)
  description = "List of Secrets Manager secret ARNs that the task execution role can access"
  default     = []
}

#------------------------------------------------------------------------------
# S3 Access
#------------------------------------------------------------------------------

variable "s3_bucket_arns" {
  type        = list(string)
  description = "List of S3 bucket ARNs that the task role can access"
  default     = []
}

#------------------------------------------------------------------------------
# Encryption
#------------------------------------------------------------------------------

variable "kms_key_arns" {
  type        = list(string)
  description = "List of KMS key ARNs for decrypting secrets (if secrets are KMS-encrypted)"
  default     = []
}

#------------------------------------------------------------------------------
# Optional Features
#------------------------------------------------------------------------------

variable "enable_ecs_exec" {
  type        = bool
  description = "Enable ECS Exec for interactive debugging (SSM Session Manager)"
  default     = false
}

variable "enable_xray" {
  type        = bool
  description = "Enable AWS X-Ray distributed tracing"
  default     = false
}

#------------------------------------------------------------------------------
# Custom Policies
#------------------------------------------------------------------------------

variable "task_custom_policy_json" {
  type        = string
  description = "Custom IAM policy JSON to attach to the task role (optional)"
  default     = null
}

variable "task_execution_custom_policy_json" {
  type        = string
  description = "Custom IAM policy JSON to attach to the task execution role (optional)"
  default     = null
}

#------------------------------------------------------------------------------
# Tags
#------------------------------------------------------------------------------

variable "tags" {
  type        = map(string)
  description = "Additional tags to apply to all resources"
  default     = {}
}
