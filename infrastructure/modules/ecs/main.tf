#------------------------------------------------------------------------------
# AWS ECS Fargate Module - Code Reviewer Infrastructure
# Creates ECS Cluster, Task Definition, Service, and Auto Scaling
#------------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # Container environment variables (non-sensitive)
  container_environment = [
    { name = "NODE_ENV", value = var.node_env },
    { name = "LOG_LEVEL", value = var.log_level },
    { name = "PORT", value = tostring(var.container_port) },

    # Database configuration (non-sensitive)
    { name = "DB_HOST", value = var.db_host },
    { name = "DB_PORT", value = tostring(var.db_port) },
    { name = "DB_NAME", value = var.db_name },
    { name = "DB_USERNAME", value = var.db_username },
    { name = "DB_SSL", value = var.db_ssl ? "true" : "false" },

    # Redis configuration (non-sensitive)
    { name = "REDIS_HOST", value = var.redis_host },
    { name = "REDIS_PORT", value = tostring(var.redis_port) },
    { name = "REDIS_TLS", value = var.redis_tls ? "true" : "false" },

    # S3 buckets
    { name = "S3_REPOS_BUCKET", value = var.s3_repos_bucket },
    { name = "S3_SCANS_BUCKET", value = var.s3_scans_bucket },
    { name = "S3_TEMP_BUCKET", value = var.s3_temp_bucket },

    # AWS Region
    { name = "AWS_REGION", value = var.aws_region },

    # Application URLs
    { name = "APP_URL", value = var.app_url },
    { name = "API_URL", value = var.api_url },

    # GitHub OAuth callback URL
    { name = "GITHUB_CALLBACK_URL", value = var.github_callback_url },

    # Feature flags
    { name = "ENABLE_SWAGGER", value = var.enable_swagger ? "true" : "false" },
    { name = "ENABLE_METRICS", value = var.enable_metrics ? "true" : "false" },
  ]

  # Container secrets (from Secrets Manager)
  container_secrets = [
    { name = "DB_PASSWORD", valueFrom = var.db_password_secret_arn },
    { name = "REDIS_PASSWORD", valueFrom = var.redis_password_secret_arn },
    { name = "JWT_PRIVATE_KEY", valueFrom = var.jwt_private_key_secret_arn },
    { name = "JWT_PUBLIC_KEY", valueFrom = var.jwt_public_key_secret_arn },
    { name = "SESSION_SECRET", valueFrom = var.session_secret_arn },
    { name = "GITHUB_CLIENT_ID", valueFrom = var.github_client_id_secret_arn },
    { name = "GITHUB_CLIENT_SECRET", valueFrom = var.github_client_secret_secret_arn },
    { name = "GITHUB_TOKEN", valueFrom = var.github_token_secret_arn },
  ]

  # Common tags
  common_tags = merge(var.tags, {
    Module    = "ecs"
    Service   = "api"
    ManagedBy = "terraform"
  })
}

#------------------------------------------------------------------------------
# ECS Cluster
#------------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cluster"
  })
}

#------------------------------------------------------------------------------
# ECS Cluster Capacity Providers
#------------------------------------------------------------------------------

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = var.fargate_base_count
    weight            = var.fargate_weight
    capacity_provider = "FARGATE"
  }

  dynamic "default_capacity_provider_strategy" {
    for_each = var.enable_fargate_spot ? [1] : []
    content {
      weight            = var.fargate_spot_weight
      capacity_provider = "FARGATE_SPOT"
    }
  }
}

#------------------------------------------------------------------------------
# CloudWatch Log Group
#------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}-api"
  retention_in_days = var.log_retention_days

  tags = merge(local.common_tags, {
    Name = "/ecs/${local.name_prefix}-api"
  })
}

#------------------------------------------------------------------------------
# ECS Task Definition
#------------------------------------------------------------------------------

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      healthCheck = {
        command = [
          "CMD-SHELL",
          "wget --no-verbose --tries=1 --spider http://localhost:${var.container_port}${var.health_check_path} || exit 1"
        ]
        interval    = var.health_check_interval
        timeout     = var.health_check_timeout
        retries     = var.health_check_retries
        startPeriod = var.health_check_start_period
      }

      environment = local.container_environment
      secrets     = local.container_secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      # Resource limits
      cpu    = var.container_cpu
      memory = var.container_memory

      # Linux parameters for optimization
      linuxParameters = {
        initProcessEnabled = true
      }

      # Stop timeout
      stopTimeout = var.container_stop_timeout
    }
  ])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-api"
  })
}

#------------------------------------------------------------------------------
# ECS Service
#------------------------------------------------------------------------------

resource "aws_ecs_service" "api" {
  name                              = "${local.name_prefix}-api"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.api.arn
  desired_count                     = var.desired_count
  launch_type                       = var.enable_fargate_spot ? null : "FARGATE"
  platform_version                  = var.platform_version
  health_check_grace_period_seconds = var.health_check_grace_period
  enable_execute_command            = var.enable_execute_command
  force_new_deployment              = var.force_new_deployment
  propagate_tags                    = "SERVICE"

  # Use capacity provider strategy when Fargate Spot is enabled
  dynamic "capacity_provider_strategy" {
    for_each = var.enable_fargate_spot ? [1] : []
    content {
      base              = var.fargate_base_count
      weight            = var.fargate_weight
      capacity_provider = "FARGATE"
    }
  }

  dynamic "capacity_provider_strategy" {
    for_each = var.enable_fargate_spot ? [1] : []
    content {
      weight            = var.fargate_spot_weight
      capacity_provider = "FARGATE_SPOT"
    }
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = var.container_port
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = var.enable_deployment_circuit_breaker
    rollback = var.enable_deployment_rollback
  }

  # Service Connect for service mesh (optional)
  dynamic "service_connect_configuration" {
    for_each = var.enable_service_connect ? [1] : []
    content {
      enabled   = true
      namespace = var.service_connect_namespace
    }
  }

  # Ignore changes to desired_count as it's managed by auto scaling
  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-api"
  })

  depends_on = [
    aws_ecs_cluster_capacity_providers.main
  ]
}

#------------------------------------------------------------------------------
# Application Auto Scaling - Target
#------------------------------------------------------------------------------

resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = local.common_tags
}

#------------------------------------------------------------------------------
# Application Auto Scaling - CPU Policy
#------------------------------------------------------------------------------

resource "aws_appautoscaling_policy" "cpu" {
  count = var.enable_cpu_autoscaling ? 1 : 0

  name               = "${local.name_prefix}-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

#------------------------------------------------------------------------------
# Application Auto Scaling - Memory Policy
#------------------------------------------------------------------------------

resource "aws_appautoscaling_policy" "memory" {
  count = var.enable_memory_autoscaling ? 1 : 0

  name               = "${local.name_prefix}-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.memory_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

#------------------------------------------------------------------------------
# Application Auto Scaling - Request Count Policy (ALB)
#------------------------------------------------------------------------------

resource "aws_appautoscaling_policy" "requests" {
  count = var.enable_request_autoscaling ? 1 : 0

  name               = "${local.name_prefix}-request-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.request_count_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = var.alb_arn_suffix != "" ? "${var.alb_arn_suffix}/${var.target_group_arn_suffix}" : null
    }
  }
}

#------------------------------------------------------------------------------
# Scheduled Scaling Actions (Optional)
#------------------------------------------------------------------------------

resource "aws_appautoscaling_scheduled_action" "scale_down" {
  count = var.enable_scheduled_scaling ? 1 : 0

  name               = "${local.name_prefix}-scale-down"
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  schedule           = var.scale_down_schedule
  timezone           = var.schedule_timezone

  scalable_target_action {
    min_capacity = var.scheduled_min_capacity
    max_capacity = var.scheduled_max_capacity
  }
}

resource "aws_appautoscaling_scheduled_action" "scale_up" {
  count = var.enable_scheduled_scaling ? 1 : 0

  name               = "${local.name_prefix}-scale-up"
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  schedule           = var.scale_up_schedule
  timezone           = var.schedule_timezone

  scalable_target_action {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }
}
