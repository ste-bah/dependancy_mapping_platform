#------------------------------------------------------------------------------
# AWS ECS Fargate Module - Outputs
# These outputs are consumed by downstream modules: CloudWatch, monitoring
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# ECS Cluster Outputs
#------------------------------------------------------------------------------

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

#------------------------------------------------------------------------------
# ECS Service Outputs
#------------------------------------------------------------------------------

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.api.name
}

output "service_arn" {
  description = "ARN of the ECS service (for IAM policies)"
  value       = aws_ecs_service.api.id
}

output "service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.api.id
}

output "service_desired_count" {
  description = "Desired count of tasks in the service"
  value       = aws_ecs_service.api.desired_count
}

#------------------------------------------------------------------------------
# ECS Task Definition Outputs
#------------------------------------------------------------------------------

output "task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.api.arn
}

output "task_definition_family" {
  description = "Family of the ECS task definition"
  value       = aws_ecs_task_definition.api.family
}

output "task_definition_revision" {
  description = "Revision number of the ECS task definition"
  value       = aws_ecs_task_definition.api.revision
}

output "task_definition_arn_without_revision" {
  description = "ARN of the task definition without revision (for update triggers)"
  value       = replace(aws_ecs_task_definition.api.arn, "/:${aws_ecs_task_definition.api.revision}$/", "")
}

#------------------------------------------------------------------------------
# CloudWatch Log Group Outputs
#------------------------------------------------------------------------------

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.arn
}

#------------------------------------------------------------------------------
# Auto Scaling Outputs
#------------------------------------------------------------------------------

output "autoscaling_target_resource_id" {
  description = "Resource ID for auto scaling target"
  value       = aws_appautoscaling_target.ecs.resource_id
}

output "autoscaling_min_capacity" {
  description = "Minimum capacity for auto scaling"
  value       = aws_appautoscaling_target.ecs.min_capacity
}

output "autoscaling_max_capacity" {
  description = "Maximum capacity for auto scaling"
  value       = aws_appautoscaling_target.ecs.max_capacity
}

output "cpu_autoscaling_policy_arn" {
  description = "ARN of the CPU auto scaling policy"
  value       = var.enable_cpu_autoscaling ? aws_appautoscaling_policy.cpu[0].arn : null
}

output "memory_autoscaling_policy_arn" {
  description = "ARN of the memory auto scaling policy"
  value       = var.enable_memory_autoscaling ? aws_appautoscaling_policy.memory[0].arn : null
}

#------------------------------------------------------------------------------
# CloudWatch Metric Dimensions (for monitoring/alarms)
#------------------------------------------------------------------------------

output "cloudwatch_dimensions" {
  description = "CloudWatch dimensions for ECS metrics"
  value = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }
}

#------------------------------------------------------------------------------
# Configuration Summary (for documentation)
#------------------------------------------------------------------------------

output "ecs_configuration" {
  description = "Complete ECS configuration summary for documentation and monitoring"
  value = {
    cluster_name           = aws_ecs_cluster.main.name
    cluster_arn            = aws_ecs_cluster.main.arn
    service_name           = aws_ecs_service.api.name
    service_arn            = aws_ecs_service.api.id
    task_definition_family = aws_ecs_task_definition.api.family
    task_definition_arn    = aws_ecs_task_definition.api.arn
    log_group_name         = aws_cloudwatch_log_group.ecs.name
    container_port         = var.container_port
    cpu                    = var.task_cpu
    memory                 = var.task_memory
    min_capacity           = var.min_capacity
    max_capacity           = var.max_capacity
    desired_count          = var.desired_count
    container_insights     = var.enable_container_insights
    execute_command        = var.enable_execute_command
  }
}

#------------------------------------------------------------------------------
# Connection Information (for ECS Exec)
#------------------------------------------------------------------------------

output "ecs_exec_command" {
  description = "Example command for ECS Exec (debugging)"
  value       = "aws ecs execute-command --cluster ${aws_ecs_cluster.main.name} --task <TASK_ID> --container api --interactive --command /bin/sh"
}

#------------------------------------------------------------------------------
# Deployment Information
#------------------------------------------------------------------------------

output "deployment_info" {
  description = "Deployment configuration summary"
  value = {
    minimum_healthy_percent = var.deployment_minimum_healthy_percent
    maximum_percent         = var.deployment_maximum_percent
    circuit_breaker_enabled = var.enable_deployment_circuit_breaker
    rollback_enabled        = var.enable_deployment_rollback
    fargate_spot_enabled    = var.enable_fargate_spot
    platform_version        = var.platform_version
  }
}
