#------------------------------------------------------------------------------
# AWS CloudWatch Monitoring Module - Code Reviewer Infrastructure
# Creates comprehensive monitoring with alarms and dashboard for:
# - ECS Fargate (CPU, Memory, Task count)
# - Application Load Balancer (Response time, Error rates, Healthy hosts)
# - RDS PostgreSQL (CPU, Storage, Connections)
# - ElastiCache Redis (CPU, Memory, Evictions)
#------------------------------------------------------------------------------

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
    Module      = "cloudwatch"
    Environment = var.environment
    ManagedBy   = "terraform"
  })

  # SNS alarm actions - empty list if no topic provided
  alarm_actions = var.sns_alarm_topic_arn != "" ? [var.sns_alarm_topic_arn] : []
  ok_actions    = var.sns_alarm_topic_arn != "" ? [var.sns_alarm_topic_arn] : []
}

#------------------------------------------------------------------------------
# ECS CloudWatch Alarms
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_utilization" {
  alarm_name          = "${local.name_prefix}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.ecs_cpu_threshold
  alarm_description   = "ECS service CPU utilization is above ${var.ecs_cpu_threshold}%"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-ecs-cpu-high"
    Type  = "ECS"
    Alarm = "CPU"
  })
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_utilization" {
  alarm_name          = "${local.name_prefix}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.ecs_memory_threshold
  alarm_description   = "ECS service memory utilization is above ${var.ecs_memory_threshold}%"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-ecs-memory-high"
    Type  = "ECS"
    Alarm = "Memory"
  })
}

resource "aws_cloudwatch_metric_alarm" "ecs_running_task_count" {
  alarm_name          = "${local.name_prefix}-ecs-running-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = var.ecs_min_task_count
  alarm_description   = "ECS running task count is below ${var.ecs_min_task_count}"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-ecs-running-tasks-low"
    Type  = "ECS"
    Alarm = "TaskCount"
  })
}

#------------------------------------------------------------------------------
# ALB CloudWatch Alarms
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "alb_target_response_time" {
  alarm_name          = "${local.name_prefix}-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = var.alb_response_time_threshold
  alarm_description   = "ALB p95 target response time is above ${var.alb_response_time_threshold} seconds"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-alb-response-time-high"
    Type  = "ALB"
    Alarm = "ResponseTime"
  })
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${local.name_prefix}-alb-5xx-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = var.alb_5xx_error_threshold
  alarm_description   = "ALB HTTP 5XX error count is above ${var.alb_5xx_error_threshold} per minute"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-alb-5xx-errors-high"
    Type  = "ALB"
    Alarm = "5XXErrors"
  })
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${local.name_prefix}-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "ALB has unhealthy hosts in target group"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-alb-unhealthy-hosts"
    Type  = "ALB"
    Alarm = "UnhealthyHosts"
  })
}

resource "aws_cloudwatch_metric_alarm" "alb_4xx_errors" {
  alarm_name          = "${local.name_prefix}-alb-4xx-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "HTTPCode_Target_4XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alb_4xx_error_threshold
  alarm_description   = "ALB HTTP 4XX error count is above ${var.alb_4xx_error_threshold} over 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-alb-4xx-errors-high"
    Type  = "ALB"
    Alarm = "4XXErrors"
  })
}

#------------------------------------------------------------------------------
# RDS CloudWatch Alarms
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "rds_cpu_utilization" {
  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_cpu_threshold
  alarm_description   = "RDS CPU utilization is above ${var.rds_cpu_threshold}%"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-rds-cpu-high"
    Type  = "RDS"
    Alarm = "CPU"
  })
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${local.name_prefix}-rds-free-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_free_storage_threshold_bytes
  alarm_description   = "RDS free storage space is below ${var.rds_free_storage_threshold_bytes / 1073741824} GB"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-rds-free-storage-low"
    Type  = "RDS"
    Alarm = "Storage"
  })
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${local.name_prefix}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_connections_threshold
  alarm_description   = "RDS database connections exceed ${var.rds_connections_threshold}"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-rds-connections-high"
    Type  = "RDS"
    Alarm = "Connections"
  })
}

resource "aws_cloudwatch_metric_alarm" "rds_freeable_memory" {
  alarm_name          = "${local.name_prefix}-rds-freeable-memory-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_freeable_memory_threshold_bytes
  alarm_description   = "RDS freeable memory is below threshold"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-rds-freeable-memory-low"
    Type  = "RDS"
    Alarm = "Memory"
  })
}

resource "aws_cloudwatch_metric_alarm" "rds_read_latency" {
  alarm_name          = "${local.name_prefix}-rds-read-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_read_latency_threshold
  alarm_description   = "RDS read latency is above ${var.rds_read_latency_threshold} seconds"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-rds-read-latency-high"
    Type  = "RDS"
    Alarm = "ReadLatency"
  })
}

resource "aws_cloudwatch_metric_alarm" "rds_write_latency" {
  alarm_name          = "${local.name_prefix}-rds-write-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "WriteLatency"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_write_latency_threshold
  alarm_description   = "RDS write latency is above ${var.rds_write_latency_threshold} seconds"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-rds-write-latency-high"
    Type  = "RDS"
    Alarm = "WriteLatency"
  })
}

#------------------------------------------------------------------------------
# ElastiCache Redis CloudWatch Alarms
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "elasticache_cpu_utilization" {
  alarm_name          = "${local.name_prefix}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.elasticache_cpu_threshold
  alarm_description   = "ElastiCache Redis CPU utilization is above ${var.elasticache_cpu_threshold}%"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-redis-cpu-high"
    Type  = "ElastiCache"
    Alarm = "CPU"
  })
}

resource "aws_cloudwatch_metric_alarm" "elasticache_memory_utilization" {
  alarm_name          = "${local.name_prefix}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.elasticache_memory_threshold
  alarm_description   = "ElastiCache Redis memory utilization is above ${var.elasticache_memory_threshold}%"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-redis-memory-high"
    Type  = "ElastiCache"
    Alarm = "Memory"
  })
}

resource "aws_cloudwatch_metric_alarm" "elasticache_evictions" {
  alarm_name          = "${local.name_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = var.elasticache_evictions_threshold
  alarm_description   = "ElastiCache Redis evictions exceed ${var.elasticache_evictions_threshold}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-redis-evictions"
    Type  = "ElastiCache"
    Alarm = "Evictions"
  })
}

resource "aws_cloudwatch_metric_alarm" "elasticache_connections" {
  alarm_name          = "${local.name_prefix}-redis-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.elasticache_connections_threshold
  alarm_description   = "ElastiCache Redis connections exceed ${var.elasticache_connections_threshold}"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-redis-connections-high"
    Type  = "ElastiCache"
    Alarm = "Connections"
  })
}

resource "aws_cloudwatch_metric_alarm" "elasticache_replication_lag" {
  alarm_name          = "${local.name_prefix}-redis-replication-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Maximum"
  threshold           = var.elasticache_replication_lag_threshold
  alarm_description   = "ElastiCache Redis replication lag exceeds ${var.elasticache_replication_lag_threshold} seconds"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-redis-replication-lag"
    Type  = "ElastiCache"
    Alarm = "ReplicationLag"
  })
}

#------------------------------------------------------------------------------
# CloudWatch Dashboard
#------------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "main" {
  count = var.enable_dashboard ? 1 : 0

  dashboard_name = "${local.name_prefix}-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: ECS Metrics
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# ECS Fargate - API Service"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 8
        height = 6
        properties = {
          title   = "ECS CPU Utilization"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { stat = "Average", period = 300 }]
          ]
          annotations = {
            horizontal = [
              { label = "CPU Threshold", value = var.ecs_cpu_threshold, fill = "above" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 1
        width  = 8
        height = 6
        properties = {
          title   = "ECS Memory Utilization"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { stat = "Average", period = 300 }]
          ]
          annotations = {
            horizontal = [
              { label = "Memory Threshold", value = var.ecs_memory_threshold, fill = "above" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 1
        width  = 8
        height = 6
        properties = {
          title   = "ECS Running Task Count"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["ECS/ContainerInsights", "RunningTaskCount", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { stat = "Average", period = 60 }]
          ]
          annotations = {
            horizontal = [
              { label = "Minimum Tasks", value = var.ecs_min_task_count, fill = "below" }
            ]
          }
        }
      },

      # Row 2: ALB Metrics
      {
        type   = "text"
        x      = 0
        y      = 7
        width  = 24
        height = 1
        properties = {
          markdown = "# Application Load Balancer"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 8
        width  = 6
        height = 6
        properties = {
          title   = "Request Count"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", period = 60 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 8
        width  = 6
        height = 6
        properties = {
          title   = "Target Response Time (p95)"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "p95", period = 300 }]
          ]
          annotations = {
            horizontal = [
              { label = "Response Threshold", value = var.alb_response_time_threshold, fill = "above" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 8
        width  = 6
        height = 6
        properties = {
          title   = "HTTP Error Rates"
          view    = "timeSeries"
          stacked = true
          region  = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Sum", period = 60, color = "#ff7f0e" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Sum", period = 60, color = "#d62728" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 8
        width  = 6
        height = 6
        properties = {
          title   = "Healthy vs Unhealthy Hosts"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Maximum", period = 60, color = "#2ca02c" }],
            ["AWS/ApplicationELB", "UnHealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix, { stat = "Maximum", period = 60, color = "#d62728" }]
          ]
        }
      },

      # Row 3: RDS Metrics
      {
        type   = "text"
        x      = 0
        y      = 14
        width  = 24
        height = 1
        properties = {
          markdown = "# RDS PostgreSQL Database"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 15
        width  = 6
        height = 6
        properties = {
          title   = "RDS CPU Utilization"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_identifier, { stat = "Average", period = 300 }]
          ]
          annotations = {
            horizontal = [
              { label = "CPU Threshold", value = var.rds_cpu_threshold, fill = "above" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 15
        width  = 6
        height = 6
        properties = {
          title   = "Database Connections"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_instance_identifier, { stat = "Average", period = 300 }]
          ]
          annotations = {
            horizontal = [
              { label = "Connection Threshold", value = var.rds_connections_threshold, fill = "above" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 15
        width  = 6
        height = 6
        properties = {
          title   = "Free Storage Space (GB)"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.rds_instance_identifier, { stat = "Average", period = 300 }]
          ]
          yAxis = {
            left = {
              label     = "Bytes"
              showUnits = false
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 15
        width  = 6
        height = 6
        properties = {
          title   = "Read/Write Latency"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/RDS", "ReadLatency", "DBInstanceIdentifier", var.rds_instance_identifier, { stat = "Average", period = 300, color = "#1f77b4" }],
            ["AWS/RDS", "WriteLatency", "DBInstanceIdentifier", var.rds_instance_identifier, { stat = "Average", period = 300, color = "#ff7f0e" }]
          ]
        }
      },

      # Row 4: ElastiCache Metrics
      {
        type   = "text"
        x      = 0
        y      = 21
        width  = 24
        height = 1
        properties = {
          markdown = "# ElastiCache Redis"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 22
        width  = 6
        height = 6
        properties = {
          title   = "Redis CPU Utilization"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", var.elasticache_cluster_id, { stat = "Average", period = 300 }]
          ]
          annotations = {
            horizontal = [
              { label = "CPU Threshold", value = var.elasticache_cpu_threshold, fill = "above" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 22
        width  = 6
        height = 6
        properties = {
          title   = "Redis Memory Usage"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "CacheClusterId", var.elasticache_cluster_id, { stat = "Average", period = 300 }]
          ]
          annotations = {
            horizontal = [
              { label = "Memory Threshold", value = var.elasticache_memory_threshold, fill = "above" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 22
        width  = 6
        height = 6
        properties = {
          title   = "Redis Connections"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "CurrConnections", "CacheClusterId", var.elasticache_cluster_id, { stat = "Average", period = 300 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 22
        width  = 6
        height = 6
        properties = {
          title   = "Redis Evictions & Cache Hits"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "Evictions", "CacheClusterId", var.elasticache_cluster_id, { stat = "Sum", period = 300, color = "#d62728" }],
            ["AWS/ElastiCache", "CacheHitRate", "CacheClusterId", var.elasticache_cluster_id, { stat = "Average", period = 300, color = "#2ca02c", yAxis = "right" }]
          ]
          yAxis = {
            right = {
              label = "Hit Rate %"
              min   = 0
              max   = 100
            }
          }
        }
      },

      # Row 5: Alarm Summary
      {
        type   = "text"
        x      = 0
        y      = 28
        width  = 24
        height = 1
        properties = {
          markdown = "# Alarm Status"
        }
      },
      {
        type   = "alarm"
        x      = 0
        y      = 29
        width  = 24
        height = 3
        properties = {
          title = "Active Alarms"
          alarms = [
            aws_cloudwatch_metric_alarm.ecs_cpu_utilization.arn,
            aws_cloudwatch_metric_alarm.ecs_memory_utilization.arn,
            aws_cloudwatch_metric_alarm.ecs_running_task_count.arn,
            aws_cloudwatch_metric_alarm.alb_target_response_time.arn,
            aws_cloudwatch_metric_alarm.alb_5xx_errors.arn,
            aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.arn,
            aws_cloudwatch_metric_alarm.rds_cpu_utilization.arn,
            aws_cloudwatch_metric_alarm.rds_free_storage.arn,
            aws_cloudwatch_metric_alarm.rds_connections.arn,
            aws_cloudwatch_metric_alarm.elasticache_cpu_utilization.arn,
            aws_cloudwatch_metric_alarm.elasticache_memory_utilization.arn,
            aws_cloudwatch_metric_alarm.elasticache_evictions.arn
          ]
        }
      }
    ]
  })
}

#------------------------------------------------------------------------------
# Log Metric Filters for Application-Level Monitoring
#------------------------------------------------------------------------------

resource "aws_cloudwatch_log_metric_filter" "error_count" {
  count = var.ecs_log_group_name != "" ? 1 : 0

  name           = "${local.name_prefix}-error-count"
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"
  log_group_name = var.ecs_log_group_name

  metric_transformation {
    name          = "ErrorCount"
    namespace     = "${var.project_name}/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "warn_count" {
  count = var.ecs_log_group_name != "" ? 1 : 0

  name           = "${local.name_prefix}-warn-count"
  pattern        = "[timestamp, request_id, level=\"WARN\", ...]"
  log_group_name = var.ecs_log_group_name

  metric_transformation {
    name          = "WarnCount"
    namespace     = "${var.project_name}/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "application_errors" {
  count = var.ecs_log_group_name != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-application-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ErrorCount"
  namespace           = "${var.project_name}/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = var.application_error_threshold
  alarm_description   = "Application error count exceeds ${var.application_error_threshold} in 5 minutes"
  treat_missing_data  = "notBreaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.ok_actions

  tags = merge(local.common_tags, {
    Name  = "${local.name_prefix}-application-errors"
    Type  = "Application"
    Alarm = "Errors"
  })
}
