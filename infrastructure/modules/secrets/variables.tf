# Variables for AWS Secrets Manager Module

variable "project_name" {
  description = "Name of the project, used in resource naming"
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

variable "kms_key_id" {
  description = "ARN or ID of the KMS key to encrypt secrets. If not provided, uses AWS managed key."
  type        = string
  default     = null
}

variable "recovery_window_in_days" {
  description = "Number of days AWS Secrets Manager waits before deleting a secret (0 to force immediate deletion, 7-30 for recovery window)"
  type        = number
  default     = 7

  validation {
    condition     = var.recovery_window_in_days == 0 || (var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30)
    error_message = "Recovery window must be 0 (force delete) or between 7 and 30 days."
  }
}

variable "tags" {
  description = "Tags to apply to all secrets"
  type        = map(string)
  default     = {}
}

# =============================================================================
# Optional Initial Values for Placeholder Secrets
# These allow setting values at creation time; ignored after initial creation
# =============================================================================

variable "jwt_private_key_value" {
  description = "Initial value for JWT private key secret (leave empty for placeholder)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "jwt_public_key_value" {
  description = "Initial value for JWT public key secret (leave empty for placeholder)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_client_id_value" {
  description = "Initial value for GitHub OAuth client ID (leave empty for placeholder)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_client_secret_value" {
  description = "Initial value for GitHub OAuth client secret (leave empty for placeholder)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_token_value" {
  description = "Initial value for GitHub Personal Access Token (leave empty for placeholder)"
  type        = string
  default     = ""
  sensitive   = true
}
