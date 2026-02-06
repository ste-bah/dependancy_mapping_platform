# Outputs for AWS Secrets Manager Module
# These ARNs can be used by other modules to grant access to secrets

# =============================================================================
# Database Password
# =============================================================================

output "db_password_secret_arn" {
  description = "ARN of the PostgreSQL database password secret"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "db_password_secret_name" {
  description = "Name of the PostgreSQL database password secret"
  value       = aws_secretsmanager_secret.db_password.name
}

# =============================================================================
# Redis Password
# =============================================================================

output "redis_password_secret_arn" {
  description = "ARN of the Redis AUTH token secret"
  value       = aws_secretsmanager_secret.redis_password.arn
}

output "redis_password_secret_name" {
  description = "Name of the Redis AUTH token secret"
  value       = aws_secretsmanager_secret.redis_password.name
}

# =============================================================================
# JWT Private Key
# =============================================================================

output "jwt_private_key_secret_arn" {
  description = "ARN of the JWT RS256 private key secret"
  value       = aws_secretsmanager_secret.jwt_private_key.arn
}

output "jwt_private_key_secret_name" {
  description = "Name of the JWT RS256 private key secret"
  value       = aws_secretsmanager_secret.jwt_private_key.name
}

# =============================================================================
# JWT Public Key
# =============================================================================

output "jwt_public_key_secret_arn" {
  description = "ARN of the JWT RS256 public key secret"
  value       = aws_secretsmanager_secret.jwt_public_key.arn
}

output "jwt_public_key_secret_name" {
  description = "Name of the JWT RS256 public key secret"
  value       = aws_secretsmanager_secret.jwt_public_key.name
}

# =============================================================================
# Session Secret
# =============================================================================

output "session_secret_arn" {
  description = "ARN of the session signing secret"
  value       = aws_secretsmanager_secret.session_secret.arn
}

output "session_secret_name" {
  description = "Name of the session signing secret"
  value       = aws_secretsmanager_secret.session_secret.name
}

# =============================================================================
# GitHub OAuth Client ID
# =============================================================================

output "github_client_id_secret_arn" {
  description = "ARN of the GitHub OAuth client ID secret"
  value       = aws_secretsmanager_secret.github_client_id.arn
}

output "github_client_id_secret_name" {
  description = "Name of the GitHub OAuth client ID secret"
  value       = aws_secretsmanager_secret.github_client_id.name
}

# =============================================================================
# GitHub OAuth Client Secret
# =============================================================================

output "github_client_secret_secret_arn" {
  description = "ARN of the GitHub OAuth client secret"
  value       = aws_secretsmanager_secret.github_client_secret.arn
}

output "github_client_secret_secret_name" {
  description = "Name of the GitHub OAuth client secret"
  value       = aws_secretsmanager_secret.github_client_secret.name
}

# =============================================================================
# GitHub Personal Access Token
# =============================================================================

output "github_token_secret_arn" {
  description = "ARN of the GitHub Personal Access Token secret"
  value       = aws_secretsmanager_secret.github_token.arn
}

output "github_token_secret_name" {
  description = "Name of the GitHub Personal Access Token secret"
  value       = aws_secretsmanager_secret.github_token.name
}

# =============================================================================
# Aggregate Outputs for Convenience
# =============================================================================

output "all_secret_arns" {
  description = "Map of all secret ARNs for IAM policy creation"
  value = {
    db_password          = aws_secretsmanager_secret.db_password.arn
    redis_password       = aws_secretsmanager_secret.redis_password.arn
    jwt_private_key      = aws_secretsmanager_secret.jwt_private_key.arn
    jwt_public_key       = aws_secretsmanager_secret.jwt_public_key.arn
    session_secret       = aws_secretsmanager_secret.session_secret.arn
    github_client_id     = aws_secretsmanager_secret.github_client_id.arn
    github_client_secret = aws_secretsmanager_secret.github_client_secret.arn
    github_token         = aws_secretsmanager_secret.github_token.arn
  }
}

output "secret_arns_list" {
  description = "List of all secret ARNs for IAM policy resource blocks"
  value = [
    aws_secretsmanager_secret.db_password.arn,
    aws_secretsmanager_secret.redis_password.arn,
    aws_secretsmanager_secret.jwt_private_key.arn,
    aws_secretsmanager_secret.jwt_public_key.arn,
    aws_secretsmanager_secret.session_secret.arn,
    aws_secretsmanager_secret.github_client_id.arn,
    aws_secretsmanager_secret.github_client_secret.arn,
    aws_secretsmanager_secret.github_token.arn,
  ]
}
