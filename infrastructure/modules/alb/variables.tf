################################################################################
# Application Load Balancer Module - Variables
################################################################################

#--------------------------------------------------------------
# Required Variables
#--------------------------------------------------------------

variable "project_name" {
  description = "Name of the project, used for resource naming"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_id" {
  description = "ID of the VPC where resources will be created"
  type        = string

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must start with 'vpc-'."
  }
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for the ALB"
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "At least 2 public subnets are required for ALB."
  }
}

variable "security_group_id" {
  description = "Security group ID for the ALB"
  type        = string

  validation {
    condition     = can(regex("^sg-", var.security_group_id))
    error_message = "Security group ID must start with 'sg-'."
  }
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS listener"
  type        = string

  validation {
    condition     = can(regex("^arn:aws:acm:", var.certificate_arn))
    error_message = "Certificate ARN must be a valid ACM certificate ARN."
  }
}

#--------------------------------------------------------------
# Optional Variables - Target Group
#--------------------------------------------------------------

variable "container_port" {
  description = "Port on which the container listens"
  type        = number
  default     = 3000

  validation {
    condition     = var.container_port > 0 && var.container_port < 65536
    error_message = "Container port must be between 1 and 65535."
  }
}

variable "deregistration_delay" {
  description = "Amount of time (seconds) for ALB to wait before deregistering a target"
  type        = number
  default     = 30

  validation {
    condition     = var.deregistration_delay >= 0 && var.deregistration_delay <= 3600
    error_message = "Deregistration delay must be between 0 and 3600 seconds."
  }
}

#--------------------------------------------------------------
# Optional Variables - Health Check
#--------------------------------------------------------------

variable "health_check_path" {
  description = "Path for health check requests"
  type        = string
  default     = "/health/live"
}

variable "health_check_interval" {
  description = "Interval (seconds) between health checks"
  type        = number
  default     = 30

  validation {
    condition     = var.health_check_interval >= 5 && var.health_check_interval <= 300
    error_message = "Health check interval must be between 5 and 300 seconds."
  }
}

variable "health_check_timeout" {
  description = "Timeout (seconds) for health check response"
  type        = number
  default     = 10

  validation {
    condition     = var.health_check_timeout >= 2 && var.health_check_timeout <= 120
    error_message = "Health check timeout must be between 2 and 120 seconds."
  }
}

variable "health_check_healthy_threshold" {
  description = "Number of consecutive successful health checks required"
  type        = number
  default     = 2

  validation {
    condition     = var.health_check_healthy_threshold >= 2 && var.health_check_healthy_threshold <= 10
    error_message = "Healthy threshold must be between 2 and 10."
  }
}

variable "health_check_unhealthy_threshold" {
  description = "Number of consecutive failed health checks required"
  type        = number
  default     = 3

  validation {
    condition     = var.health_check_unhealthy_threshold >= 2 && var.health_check_unhealthy_threshold <= 10
    error_message = "Unhealthy threshold must be between 2 and 10."
  }
}

variable "health_check_matcher" {
  description = "HTTP codes to use when checking for a successful response"
  type        = string
  default     = "200"
}

#--------------------------------------------------------------
# Optional Variables - ALB Configuration
#--------------------------------------------------------------

variable "idle_timeout" {
  description = "Time (seconds) that a connection can be idle"
  type        = number
  default     = 60

  validation {
    condition     = var.idle_timeout >= 1 && var.idle_timeout <= 4000
    error_message = "Idle timeout must be between 1 and 4000 seconds."
  }
}

variable "deletion_protection" {
  description = "Enable deletion protection for the ALB"
  type        = bool
  default     = true
}

variable "ssl_policy" {
  description = "SSL policy for HTTPS listener"
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  validation {
    condition     = can(regex("^ELBSecurityPolicy-", var.ssl_policy))
    error_message = "SSL policy must be a valid ELB security policy."
  }
}

variable "access_logs_bucket" {
  description = "S3 bucket name for ALB access logs (empty to disable)"
  type        = string
  default     = ""
}

variable "additional_certificate_arns" {
  description = "List of additional ACM certificate ARNs for HTTPS listener"
  type        = list(string)
  default     = []
}

#--------------------------------------------------------------
# Tags
#--------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
