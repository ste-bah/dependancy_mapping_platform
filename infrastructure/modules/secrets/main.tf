# AWS Secrets Manager Module for dependency-mapping-platform
# Manages application secrets with auto-generation for passwords

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Module      = "secrets"
    Environment = var.environment
  })
}

# =============================================================================
# Auto-generated Passwords
# =============================================================================

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "redis_password" {
  length  = 32
  special = false # Redis AUTH tokens work best without special chars
}

resource "random_password" "session_secret" {
  length  = 64
  special = false
}

# =============================================================================
# Database Password Secret
# =============================================================================

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${local.name_prefix}-db-password"
  description             = "PostgreSQL database password for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = merge(local.common_tags, {
    Name       = "${local.name_prefix}-db-password"
    SecretType = "database"
  })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# =============================================================================
# Redis Password Secret
# =============================================================================

resource "aws_secretsmanager_secret" "redis_password" {
  name                    = "${local.name_prefix}-redis-password"
  description             = "Redis AUTH token for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = merge(local.common_tags, {
    Name       = "${local.name_prefix}-redis-password"
    SecretType = "cache"
  })
}

resource "aws_secretsmanager_secret_version" "redis_password" {
  secret_id     = aws_secretsmanager_secret.redis_password.id
  secret_string = random_password.redis_password.result
}

# =============================================================================
# JWT Private Key Secret
# =============================================================================

resource "aws_secretsmanager_secret" "jwt_private_key" {
  name                    = "${local.name_prefix}-jwt-private-key"
  description             = "JWT RS256 private key for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = merge(local.common_tags, {
    Name       = "${local.name_prefix}-jwt-private-key"
    SecretType = "jwt"
  })
}

resource "aws_secretsmanager_secret_version" "jwt_private_key" {
  secret_id     = aws_secretsmanager_secret.jwt_private_key.id
  secret_string = var.jwt_private_key_value != "" ? var.jwt_private_key_value : "PLACEHOLDER_REPLACE_WITH_ACTUAL_RSA_PRIVATE_KEY"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# JWT Public Key Secret
# =============================================================================

resource "aws_secretsmanager_secret" "jwt_public_key" {
  name                    = "${local.name_prefix}-jwt-public-key"
  description             = "JWT RS256 public key for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = merge(local.common_tags, {
    Name       = "${local.name_prefix}-jwt-public-key"
    SecretType = "jwt"
  })
}

resource "aws_secretsmanager_secret_version" "jwt_public_key" {
  secret_id     = aws_secretsmanager_secret.jwt_public_key.id
  secret_string = var.jwt_public_key_value != "" ? var.jwt_public_key_value : "PLACEHOLDER_REPLACE_WITH_ACTUAL_RSA_PUBLIC_KEY"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# Session Secret
# =============================================================================

resource "aws_secretsmanager_secret" "session_secret" {
  name                    = "${local.name_prefix}-session-secret"
  description             = "Session signing secret for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = merge(local.common_tags, {
    Name       = "${local.name_prefix}-session-secret"
    SecretType = "session"
  })
}

resource "aws_secretsmanager_secret_version" "session_secret" {
  secret_id     = aws_secretsmanager_secret.session_secret.id
  secret_string = random_password.session_secret.result
}

# =============================================================================
# GitHub OAuth Client ID Secret
# =============================================================================

resource "aws_secretsmanager_secret" "github_client_id" {
  name                    = "${local.name_prefix}-github-client-id"
  description             = "GitHub OAuth client ID for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = merge(local.common_tags, {
    Name       = "${local.name_prefix}-github-client-id"
    SecretType = "oauth"
  })
}

resource "aws_secretsmanager_secret_version" "github_client_id" {
  secret_id     = aws_secretsmanager_secret.github_client_id.id
  secret_string = var.github_client_id_value != "" ? var.github_client_id_value : "PLACEHOLDER_REPLACE_WITH_GITHUB_CLIENT_ID"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# GitHub OAuth Client Secret
# =============================================================================

resource "aws_secretsmanager_secret" "github_client_secret" {
  name                    = "${local.name_prefix}-github-client-secret"
  description             = "GitHub OAuth client secret for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = merge(local.common_tags, {
    Name       = "${local.name_prefix}-github-client-secret"
    SecretType = "oauth"
  })
}

resource "aws_secretsmanager_secret_version" "github_client_secret" {
  secret_id     = aws_secretsmanager_secret.github_client_secret.id
  secret_string = var.github_client_secret_value != "" ? var.github_client_secret_value : "PLACEHOLDER_REPLACE_WITH_GITHUB_CLIENT_SECRET"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# GitHub Personal Access Token Secret
# =============================================================================

resource "aws_secretsmanager_secret" "github_token" {
  name                    = "${local.name_prefix}-github-token"
  description             = "GitHub Personal Access Token for ${var.project_name} ${var.environment}"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.kms_key_id

  tags = merge(local.common_tags, {
    Name       = "${local.name_prefix}-github-token"
    SecretType = "pat"
  })
}

resource "aws_secretsmanager_secret_version" "github_token" {
  secret_id     = aws_secretsmanager_secret.github_token.id
  secret_string = var.github_token_value != "" ? var.github_token_value : "PLACEHOLDER_REPLACE_WITH_GITHUB_PAT"

  lifecycle {
    ignore_changes = [secret_string]
  }
}
