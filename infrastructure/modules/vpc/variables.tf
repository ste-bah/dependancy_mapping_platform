#------------------------------------------------------------------------------
# Variables for VPC Module
#------------------------------------------------------------------------------

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

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "azs" {
  description = "List of availability zones to use (e.g., ['us-east-1a', 'us-east-1b', 'us-east-1c'])"
  type        = list(string)

  validation {
    condition     = length(var.azs) >= 2 && length(var.azs) <= 6
    error_message = "Must specify between 2 and 6 availability zones for high availability."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)

  validation {
    condition     = alltrue([for cidr in var.public_subnet_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All public subnet CIDRs must be valid IPv4 CIDR blocks."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)

  validation {
    condition     = alltrue([for cidr in var.private_subnet_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All private subnet CIDRs must be valid IPv4 CIDR blocks."
  }
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets (one per AZ)"
  type        = list(string)

  validation {
    condition     = alltrue([for cidr in var.database_subnet_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All database subnet CIDRs must be valid IPv4 CIDR blocks."
  }
}

variable "enable_nat_gateway" {
  description = "Whether to create NAT Gateway(s) for private subnet internet access"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT Gateway for all AZs (cost-saving for non-prod). If false, creates one NAT per AZ."
  type        = bool
  default     = false
}

variable "enable_flow_logs" {
  description = "Whether to enable VPC Flow Logs"
  type        = bool
  default     = false
}

variable "flow_logs_role_arn" {
  description = "IAM role ARN for VPC Flow Logs (required if enable_flow_logs is true)"
  type        = string
  default     = null
}

variable "flow_logs_log_group_arn" {
  description = "CloudWatch Log Group ARN for VPC Flow Logs (required if enable_flow_logs is true)"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to all VPC resources"
  type        = map(string)
  default     = {}
}
