#------------------------------------------------------------------------------
# Outputs for AWS ElastiCache Redis Module
# These outputs are consumed by downstream modules: ECS (container environment)
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Primary Endpoint Outputs
#------------------------------------------------------------------------------

output "redis_endpoint" {
  description = "Primary endpoint address for Redis cluster (use for write operations)"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Reader endpoint address for Redis cluster (use for read operations, load balanced)"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Port number for Redis cluster"
  value       = aws_elasticache_replication_group.redis.port
}

#------------------------------------------------------------------------------
# Connection String Outputs (for ECS container configuration)
#------------------------------------------------------------------------------

output "redis_connection_url" {
  description = "Redis connection URL format for application configuration (TLS enabled)"
  value       = "rediss://${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
}

output "redis_reader_connection_url" {
  description = "Redis reader connection URL for read-heavy workloads (TLS enabled)"
  value       = "rediss://${aws_elasticache_replication_group.redis.reader_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
}

#------------------------------------------------------------------------------
# Resource Identifiers
#------------------------------------------------------------------------------

output "redis_replication_group_id" {
  description = "ID of the Redis replication group"
  value       = aws_elasticache_replication_group.redis.id
}

output "redis_replication_group_arn" {
  description = "ARN of the Redis replication group"
  value       = aws_elasticache_replication_group.redis.arn
}

output "redis_parameter_group_id" {
  description = "ID of the Redis parameter group"
  value       = aws_elasticache_parameter_group.redis.id
}

output "redis_parameter_group_name" {
  description = "Name of the Redis parameter group"
  value       = aws_elasticache_parameter_group.redis.name
}

#------------------------------------------------------------------------------
# Cluster Member Information
#------------------------------------------------------------------------------

output "redis_member_clusters" {
  description = "List of cache cluster IDs that are part of this replication group"
  value       = aws_elasticache_replication_group.redis.member_clusters
}

output "redis_num_cache_clusters" {
  description = "Number of cache clusters in the replication group"
  value       = length(aws_elasticache_replication_group.redis.member_clusters)
}

#------------------------------------------------------------------------------
# Configuration Information (for documentation/debugging)
#------------------------------------------------------------------------------

output "redis_engine_version" {
  description = "Actual Redis engine version running"
  value       = aws_elasticache_replication_group.redis.engine_version_actual
}

output "redis_configuration" {
  description = "Redis configuration summary for documentation"
  value = {
    replication_group_id = aws_elasticache_replication_group.redis.id
    primary_endpoint     = aws_elasticache_replication_group.redis.primary_endpoint_address
    reader_endpoint      = aws_elasticache_replication_group.redis.reader_endpoint_address
    port                 = aws_elasticache_replication_group.redis.port
    engine_version       = aws_elasticache_replication_group.redis.engine_version_actual
    at_rest_encryption   = true
    transit_encryption   = true
    automatic_failover   = aws_elasticache_replication_group.redis.automatic_failover_enabled
    multi_az             = aws_elasticache_replication_group.redis.multi_az_enabled
    num_clusters         = length(aws_elasticache_replication_group.redis.member_clusters)
  }
}

#------------------------------------------------------------------------------
# CloudWatch Alarm ARNs (if created)
#------------------------------------------------------------------------------

output "cloudwatch_alarm_arns" {
  description = "ARNs of CloudWatch alarms created for Redis monitoring"
  value = {
    cpu_alarm         = var.create_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.redis_cpu[0].arn : null
    memory_alarm      = var.create_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.redis_memory[0].arn : null
    connections_alarm = var.create_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.redis_connections[0].arn : null
    evictions_alarm   = var.create_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.redis_evictions[0].arn : null
  }
}
