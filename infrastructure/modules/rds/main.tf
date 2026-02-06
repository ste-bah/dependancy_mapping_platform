# AWS RDS PostgreSQL Module for dependency-mapping-platform
# Production-ready PostgreSQL instance with encryption, Multi-AZ, and Performance Insights

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Module      = "rds"
    Environment = var.environment
  })
}

# =============================================================================
# Data Sources
# =============================================================================

# Retrieve database password from Secrets Manager
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = var.db_password_secret_arn
}

# =============================================================================
# DB Parameter Group
# =============================================================================

resource "aws_db_parameter_group" "main" {
  name        = "${local.name_prefix}-postgres15-params"
  family      = "postgres15"
  description = "Custom parameter group for ${var.project_name} ${var.environment} PostgreSQL"

  # Enable pg_stat_statements for query performance monitoring
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  # Log slow queries (queries taking more than 1 second)
  parameter {
    name         = "log_min_duration_statement"
    value        = "1000"
    apply_method = "immediate"
  }

  # Enable logging of lock waits
  parameter {
    name         = "log_lock_waits"
    value        = "1"
    apply_method = "immediate"
  }

  # Log checkpoints for performance analysis
  parameter {
    name         = "log_checkpoints"
    value        = "1"
    apply_method = "immediate"
  }

  # Track statistics for pg_stat_statements
  parameter {
    name         = "pg_stat_statements.track"
    value        = "all"
    apply_method = "pending-reboot"
  }

  # Maximum number of statements tracked
  parameter {
    name         = "pg_stat_statements.max"
    value        = "10000"
    apply_method = "pending-reboot"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres15-params"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# RDS PostgreSQL Instance
# =============================================================================

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  # Engine Configuration
  engine               = "postgres"
  engine_version       = var.engine_version
  instance_class       = var.instance_class
  parameter_group_name = aws_db_parameter_group.main.name

  # Storage Configuration
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_id

  # Database Configuration
  db_name  = var.db_name
  username = var.db_username
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
  port     = 5432

  # Network Configuration
  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false

  # High Availability
  multi_az = var.multi_az

  # Backup Configuration
  backup_retention_period   = var.backup_retention_period
  backup_window             = var.backup_window
  maintenance_window        = var.maintenance_window
  copy_tags_to_snapshot     = true
  delete_automated_backups  = false
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-postgres-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Monitoring & Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = var.performance_insights_retention_period
  performance_insights_kms_key_id       = var.kms_key_id
  monitoring_interval                   = var.enhanced_monitoring_interval
  monitoring_role_arn                   = var.monitoring_role_arn

  # CloudWatch Logs Exports
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Protection Settings
  deletion_protection = var.deletion_protection

  # Upgrade Settings
  auto_minor_version_upgrade  = var.auto_minor_version_upgrade
  allow_major_version_upgrade = false

  # IAM Authentication (optional)
  iam_database_authentication_enabled = var.iam_database_authentication_enabled

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres"
  })

  lifecycle {
    ignore_changes = [
      final_snapshot_identifier,
      password
    ]
  }
}

# =============================================================================
# CloudWatch Alarms for RDS Monitoring
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "RDS CPU utilization is above ${var.cpu_utilization_threshold}%"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "free_storage_space" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-free-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.free_storage_threshold_bytes
  alarm_description   = "RDS free storage space is below threshold"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.max_connections_threshold
  alarm_description   = "RDS database connections exceed threshold"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "freeable_memory" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-freeable-memory"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.freeable_memory_threshold_bytes
  alarm_description   = "RDS freeable memory is below threshold"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "read_latency" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-read-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.read_latency_threshold_seconds
  alarm_description   = "RDS read latency is above threshold"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "write_latency" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-write-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "WriteLatency"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.write_latency_threshold_seconds
  alarm_description   = "RDS write latency is above threshold"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}
