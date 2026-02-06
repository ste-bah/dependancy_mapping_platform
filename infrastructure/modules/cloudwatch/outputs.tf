#------------------------------------------------------------------------------
# AWS CloudWatch Monitoring Module - Outputs
# Exports alarm ARNs, dashboard information, and monitoring configurations
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# ECS Alarm Outputs
#------------------------------------------------------------------------------

output "ecs_cpu_alarm_arn" {
  description = "ARN of the ECS CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.ecs_cpu_utilization.arn
}

output "ecs_memory_alarm_arn" {
  description = "ARN of the ECS memory utilization alarm"
  value       = aws_cloudwatch_metric_alarm.ecs_memory_utilization.arn
}

output "ecs_task_count_alarm_arn" {
  description = "ARN of the ECS running task count alarm"
  value       = aws_cloudwatch_metric_alarm.ecs_running_task_count.arn
}

#------------------------------------------------------------------------------
# ALB Alarm Outputs
#------------------------------------------------------------------------------

output "alb_response_time_alarm_arn" {
  description = "ARN of the ALB response time alarm"
  value       = aws_cloudwatch_metric_alarm.alb_target_response_time.arn
}

output "alb_5xx_errors_alarm_arn" {
  description = "ARN of the ALB 5XX errors alarm"
  value       = aws_cloudwatch_metric_alarm.alb_5xx_errors.arn
}

output "alb_unhealthy_hosts_alarm_arn" {
  description = "ARN of the ALB unhealthy hosts alarm"
  value       = aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.arn
}

output "alb_4xx_errors_alarm_arn" {
  description = "ARN of the ALB 4XX errors alarm"
  value       = aws_cloudwatch_metric_alarm.alb_4xx_errors.arn
}

#------------------------------------------------------------------------------
# RDS Alarm Outputs
#------------------------------------------------------------------------------

output "rds_cpu_alarm_arn" {
  description = "ARN of the RDS CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.rds_cpu_utilization.arn
}

output "rds_storage_alarm_arn" {
  description = "ARN of the RDS free storage alarm"
  value       = aws_cloudwatch_metric_alarm.rds_free_storage.arn
}

output "rds_connections_alarm_arn" {
  description = "ARN of the RDS connections alarm"
  value       = aws_cloudwatch_metric_alarm.rds_connections.arn
}

output "rds_memory_alarm_arn" {
  description = "ARN of the RDS freeable memory alarm"
  value       = aws_cloudwatch_metric_alarm.rds_freeable_memory.arn
}

output "rds_read_latency_alarm_arn" {
  description = "ARN of the RDS read latency alarm"
  value       = aws_cloudwatch_metric_alarm.rds_read_latency.arn
}

output "rds_write_latency_alarm_arn" {
  description = "ARN of the RDS write latency alarm"
  value       = aws_cloudwatch_metric_alarm.rds_write_latency.arn
}

#------------------------------------------------------------------------------
# ElastiCache Alarm Outputs
#------------------------------------------------------------------------------

output "elasticache_cpu_alarm_arn" {
  description = "ARN of the ElastiCache CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.elasticache_cpu_utilization.arn
}

output "elasticache_memory_alarm_arn" {
  description = "ARN of the ElastiCache memory utilization alarm"
  value       = aws_cloudwatch_metric_alarm.elasticache_memory_utilization.arn
}

output "elasticache_evictions_alarm_arn" {
  description = "ARN of the ElastiCache evictions alarm"
  value       = aws_cloudwatch_metric_alarm.elasticache_evictions.arn
}

output "elasticache_connections_alarm_arn" {
  description = "ARN of the ElastiCache connections alarm"
  value       = aws_cloudwatch_metric_alarm.elasticache_connections.arn
}

output "elasticache_replication_lag_alarm_arn" {
  description = "ARN of the ElastiCache replication lag alarm"
  value       = aws_cloudwatch_metric_alarm.elasticache_replication_lag.arn
}

#------------------------------------------------------------------------------
# Application-Level Alarm Outputs
#------------------------------------------------------------------------------

output "application_errors_alarm_arn" {
  description = "ARN of the application errors alarm (if log group configured)"
  value       = var.ecs_log_group_name != "" ? aws_cloudwatch_metric_alarm.application_errors[0].arn : null
}

#------------------------------------------------------------------------------
# Aggregated Alarm ARNs Map
#------------------------------------------------------------------------------

output "alarm_arns" {
  description = "Map of all alarm ARNs by service and type"
  value = {
    ecs = {
      cpu        = aws_cloudwatch_metric_alarm.ecs_cpu_utilization.arn
      memory     = aws_cloudwatch_metric_alarm.ecs_memory_utilization.arn
      task_count = aws_cloudwatch_metric_alarm.ecs_running_task_count.arn
    }
    alb = {
      response_time   = aws_cloudwatch_metric_alarm.alb_target_response_time.arn
      errors_5xx      = aws_cloudwatch_metric_alarm.alb_5xx_errors.arn
      errors_4xx      = aws_cloudwatch_metric_alarm.alb_4xx_errors.arn
      unhealthy_hosts = aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.arn
    }
    rds = {
      cpu           = aws_cloudwatch_metric_alarm.rds_cpu_utilization.arn
      storage       = aws_cloudwatch_metric_alarm.rds_free_storage.arn
      connections   = aws_cloudwatch_metric_alarm.rds_connections.arn
      memory        = aws_cloudwatch_metric_alarm.rds_freeable_memory.arn
      read_latency  = aws_cloudwatch_metric_alarm.rds_read_latency.arn
      write_latency = aws_cloudwatch_metric_alarm.rds_write_latency.arn
    }
    elasticache = {
      cpu             = aws_cloudwatch_metric_alarm.elasticache_cpu_utilization.arn
      memory          = aws_cloudwatch_metric_alarm.elasticache_memory_utilization.arn
      evictions       = aws_cloudwatch_metric_alarm.elasticache_evictions.arn
      connections     = aws_cloudwatch_metric_alarm.elasticache_connections.arn
      replication_lag = aws_cloudwatch_metric_alarm.elasticache_replication_lag.arn
    }
    application = {
      errors = var.ecs_log_group_name != "" ? aws_cloudwatch_metric_alarm.application_errors[0].arn : null
    }
  }
}

output "all_alarm_arns" {
  description = "List of all alarm ARNs for composite alarm or notification setup"
  value = compact([
    aws_cloudwatch_metric_alarm.ecs_cpu_utilization.arn,
    aws_cloudwatch_metric_alarm.ecs_memory_utilization.arn,
    aws_cloudwatch_metric_alarm.ecs_running_task_count.arn,
    aws_cloudwatch_metric_alarm.alb_target_response_time.arn,
    aws_cloudwatch_metric_alarm.alb_5xx_errors.arn,
    aws_cloudwatch_metric_alarm.alb_4xx_errors.arn,
    aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.arn,
    aws_cloudwatch_metric_alarm.rds_cpu_utilization.arn,
    aws_cloudwatch_metric_alarm.rds_free_storage.arn,
    aws_cloudwatch_metric_alarm.rds_connections.arn,
    aws_cloudwatch_metric_alarm.rds_freeable_memory.arn,
    aws_cloudwatch_metric_alarm.rds_read_latency.arn,
    aws_cloudwatch_metric_alarm.rds_write_latency.arn,
    aws_cloudwatch_metric_alarm.elasticache_cpu_utilization.arn,
    aws_cloudwatch_metric_alarm.elasticache_memory_utilization.arn,
    aws_cloudwatch_metric_alarm.elasticache_evictions.arn,
    aws_cloudwatch_metric_alarm.elasticache_connections.arn,
    aws_cloudwatch_metric_alarm.elasticache_replication_lag.arn,
    var.ecs_log_group_name != "" ? aws_cloudwatch_metric_alarm.application_errors[0].arn : null
  ])
}

#------------------------------------------------------------------------------
# Dashboard Outputs
#------------------------------------------------------------------------------

output "dashboard_arn" {
  description = "ARN of the CloudWatch dashboard"
  value       = var.enable_dashboard ? aws_cloudwatch_dashboard.main[0].dashboard_arn : null
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = var.enable_dashboard ? aws_cloudwatch_dashboard.main[0].dashboard_name : null
}

output "dashboard_url" {
  description = "Direct URL to the CloudWatch dashboard"
  value       = var.enable_dashboard ? "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main[0].dashboard_name}" : null
}

#------------------------------------------------------------------------------
# Log Metric Filter Outputs
#------------------------------------------------------------------------------

output "error_metric_filter_name" {
  description = "Name of the error count log metric filter"
  value       = var.ecs_log_group_name != "" ? aws_cloudwatch_log_metric_filter.error_count[0].name : null
}

output "warn_metric_filter_name" {
  description = "Name of the warning count log metric filter"
  value       = var.ecs_log_group_name != "" ? aws_cloudwatch_log_metric_filter.warn_count[0].name : null
}

#------------------------------------------------------------------------------
# Configuration Summary
#------------------------------------------------------------------------------

output "monitoring_configuration" {
  description = "Summary of monitoring configuration for documentation"
  value = {
    project_name = var.project_name
    environment  = var.environment
    thresholds = {
      ecs = {
        cpu_percent    = var.ecs_cpu_threshold
        memory_percent = var.ecs_memory_threshold
        min_task_count = var.ecs_min_task_count
      }
      alb = {
        response_time_seconds = var.alb_response_time_threshold
        error_5xx_per_minute  = var.alb_5xx_error_threshold
        error_4xx_per_5min    = var.alb_4xx_error_threshold
      }
      rds = {
        cpu_percent      = var.rds_cpu_threshold
        free_storage_gb  = var.rds_free_storage_threshold_bytes / 1073741824
        connections      = var.rds_connections_threshold
        read_latency_ms  = var.rds_read_latency_threshold * 1000
        write_latency_ms = var.rds_write_latency_threshold * 1000
      }
      elasticache = {
        cpu_percent             = var.elasticache_cpu_threshold
        memory_percent          = var.elasticache_memory_threshold
        evictions               = var.elasticache_evictions_threshold
        connections             = var.elasticache_connections_threshold
        replication_lag_seconds = var.elasticache_replication_lag_threshold
      }
    }
    dashboard_enabled    = var.enable_dashboard
    sns_notifications    = var.sns_alarm_topic_arn != ""
    total_alarms_created = 18 + (var.ecs_log_group_name != "" ? 1 : 0)
  }
}
