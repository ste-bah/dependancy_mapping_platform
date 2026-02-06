#------------------------------------------------------------------------------
# AWS ElastiCache Redis Module for dependency-mapping-platform
# Creates a production-ready Redis replication group with:
# - Multi-AZ deployment with automatic failover
# - At-rest and in-transit encryption (TLS)
# - Auth token from Secrets Manager
# - Custom parameter group with allkeys-lru eviction
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Data Sources
#------------------------------------------------------------------------------

# Retrieve the Redis auth token from Secrets Manager
data "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id = var.auth_token_secret_arn
}

#------------------------------------------------------------------------------
# Redis Parameter Group
#------------------------------------------------------------------------------

resource "aws_elasticache_parameter_group" "redis" {
  name        = "${var.project_name}-${var.environment}-redis-params"
  family      = "redis7"
  description = "Custom parameter group for ${var.project_name} ${var.environment} Redis cluster"

  # Use allkeys-lru eviction policy for cache efficiency
  # This evicts the least recently used keys when memory is full
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Enable cluster mode disabled (simpler for most use cases)
  parameter {
    name  = "cluster-enabled"
    value = "no"
  }

  # Optimize for low latency
  parameter {
    name  = "activedefrag"
    value = "yes"
  }

  # Connection timeout settings
  parameter {
    name  = "timeout"
    value = "300"
  }

  # TCP keepalive for connection health
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-redis-params"
    Environment = var.environment
  })
}

#------------------------------------------------------------------------------
# Redis Replication Group
#------------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description          = "Redis replication group for ${var.project_name} ${var.environment}"

  # Engine configuration
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_clusters
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  port                 = 6379

  # Network configuration
  subnet_group_name  = var.subnet_group_name
  security_group_ids = [var.security_group_id]

  # High availability configuration
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.automatic_failover_enabled # Multi-AZ requires failover enabled

  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = data.aws_secretsmanager_secret_version.redis_auth.secret_string
  # Note: auth_token requires transit_encryption_enabled = true

  # Maintenance and backup configuration
  maintenance_window        = var.maintenance_window
  snapshot_window           = var.snapshot_window
  snapshot_retention_limit  = var.snapshot_retention_limit
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-${var.environment}-redis-final"

  # Auto minor version upgrade for security patches
  auto_minor_version_upgrade = true

  # Apply changes immediately in non-production, during maintenance window in production
  apply_immediately = var.environment != "prod"

  # Notification configuration (optional)
  notification_topic_arn = var.notification_topic_arn

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-redis"
    Environment = var.environment
    Engine      = "redis"
    Version     = var.engine_version
  })

  # Ensure parameter group is created first
  depends_on = [aws_elasticache_parameter_group.redis]

  lifecycle {
    # Prevent accidental destruction of production cache
    prevent_destroy = false # Set to true in production via environment config

    # Ignore changes to auth_token after creation (rotated externally)
    ignore_changes = [
      auth_token
    ]
  }
}

#------------------------------------------------------------------------------
# CloudWatch Alarms for Redis Monitoring (Optional)
# Using replication group ID for dimensions as member_clusters is a set
#------------------------------------------------------------------------------

locals {
  # Convert member_clusters set to list for indexing
  member_clusters_list = tolist(aws_elasticache_replication_group.redis.member_clusters)
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-cpu-high"
  alarm_description   = "Redis CPU utilization is too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75

  dimensions = {
    CacheClusterId = local.member_clusters_list[0]
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-redis-cpu-alarm"
    Environment = var.environment
  })
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-memory-high"
  alarm_description   = "Redis memory utilization is too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80

  dimensions = {
    CacheClusterId = local.member_clusters_list[0]
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-redis-memory-alarm"
    Environment = var.environment
  })
}

resource "aws_cloudwatch_metric_alarm" "redis_connections" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-connections-high"
  alarm_description   = "Redis current connections count is too high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.max_connections_threshold

  dimensions = {
    CacheClusterId = local.member_clusters_list[0]
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-redis-connections-alarm"
    Environment = var.environment
  })
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-evictions-high"
  alarm_description   = "Redis key evictions are occurring frequently"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 1000

  dimensions = {
    CacheClusterId = local.member_clusters_list[0]
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-redis-evictions-alarm"
    Environment = var.environment
  })
}
