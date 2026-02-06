#------------------------------------------------------------------------------
# IAM Module Outputs
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Task Execution Role (used by ECS agent)
#------------------------------------------------------------------------------

output "task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.task_execution.arn
}

output "task_execution_role_name" {
  description = "Name of the ECS task execution role"
  value       = aws_iam_role.task_execution.name
}

output "task_execution_role_id" {
  description = "Unique ID of the ECS task execution role"
  value       = aws_iam_role.task_execution.unique_id
}

#------------------------------------------------------------------------------
# Task Role (used by application)
#------------------------------------------------------------------------------

output "task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.task.arn
}

output "task_role_name" {
  description = "Name of the ECS task role"
  value       = aws_iam_role.task.name
}

output "task_role_id" {
  description = "Unique ID of the ECS task role"
  value       = aws_iam_role.task.unique_id
}

#------------------------------------------------------------------------------
# Aggregate Outputs
#------------------------------------------------------------------------------

output "role_arns" {
  description = "Map of all IAM role ARNs for ECS"
  value = {
    task_execution = aws_iam_role.task_execution.arn
    task           = aws_iam_role.task.arn
  }
}

output "role_names" {
  description = "Map of all IAM role names for ECS"
  value = {
    task_execution = aws_iam_role.task_execution.name
    task           = aws_iam_role.task.name
  }
}
