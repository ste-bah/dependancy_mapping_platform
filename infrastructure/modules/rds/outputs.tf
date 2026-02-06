#------------------------------------------------------------------------------
# Outputs for RDS PostgreSQL Module
# These outputs are consumed by downstream modules: ECS (for container env vars)
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# Instance Endpoint (for application connection)
#------------------------------------------------------------------------------

output "db_instance_endpoint" {
  description = "Connection endpoint for the RDS instance (host:port format)"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_address" {
  description = "Hostname of the RDS instance (without port)"
  value       = aws_db_instance.main.address
}

output "db_instance_port" {
  description = "Port number of the RDS instance"
  value       = aws_db_instance.main.port
}

#------------------------------------------------------------------------------
# Database Configuration
#------------------------------------------------------------------------------

output "db_instance_name" {
  description = "Name of the database"
  value       = aws_db_instance.main.db_name
}

output "db_instance_identifier" {
  description = "Identifier of the RDS instance"
  value       = aws_db_instance.main.identifier
}

output "db_instance_username" {
  description = "Master username for the database"
  value       = aws_db_instance.main.username
  sensitive   = true
}

#------------------------------------------------------------------------------
# Instance Details
#------------------------------------------------------------------------------

output "db_instance_id" {
  description = "ID of the RDS instance"
  value       = aws_db_instance.main.id
}

output "db_instance_arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "db_instance_resource_id" {
  description = "Resource ID of the RDS instance (for IAM authentication)"
  value       = aws_db_instance.main.resource_id
}

output "db_instance_class" {
  description = "Instance class of the RDS instance"
  value       = aws_db_instance.main.instance_class
}

output "db_instance_engine_version" {
  description = "Engine version of the RDS instance"
  value       = aws_db_instance.main.engine_version_actual
}

#------------------------------------------------------------------------------
# Storage Information
#------------------------------------------------------------------------------

output "db_instance_allocated_storage" {
  description = "Allocated storage in GB"
  value       = aws_db_instance.main.allocated_storage
}

output "db_instance_max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling in GB"
  value       = aws_db_instance.main.max_allocated_storage
}

#------------------------------------------------------------------------------
# High Availability Status
#------------------------------------------------------------------------------

output "db_instance_multi_az" {
  description = "Whether the RDS instance is Multi-AZ"
  value       = aws_db_instance.main.multi_az
}

output "db_instance_availability_zone" {
  description = "Availability zone of the RDS instance"
  value       = aws_db_instance.main.availability_zone
}

#------------------------------------------------------------------------------
# Parameter Group
#------------------------------------------------------------------------------

output "db_parameter_group_name" {
  description = "Name of the DB parameter group"
  value       = aws_db_parameter_group.main.name
}

output "db_parameter_group_id" {
  description = "ID of the DB parameter group"
  value       = aws_db_parameter_group.main.id
}

#------------------------------------------------------------------------------
# Connection String Formats (for ECS environment variables)
#------------------------------------------------------------------------------

output "db_connection_url_template" {
  description = "PostgreSQL connection URL template (password must be injected from Secrets Manager)"
  value       = "postgresql://${aws_db_instance.main.username}:PASSWORD_PLACEHOLDER@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
}

output "db_jdbc_connection_string" {
  description = "JDBC connection string for Java applications"
  value       = "jdbc:postgresql://${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
}

#------------------------------------------------------------------------------
# Monitoring Outputs
#------------------------------------------------------------------------------

output "db_instance_performance_insights_enabled" {
  description = "Whether Performance Insights is enabled"
  value       = aws_db_instance.main.performance_insights_enabled
}

output "cloudwatch_alarm_arns" {
  description = "Map of CloudWatch alarm ARNs"
  value = {
    cpu_utilization      = try(aws_cloudwatch_metric_alarm.cpu_utilization[0].arn, null)
    free_storage_space   = try(aws_cloudwatch_metric_alarm.free_storage_space[0].arn, null)
    database_connections = try(aws_cloudwatch_metric_alarm.database_connections[0].arn, null)
    freeable_memory      = try(aws_cloudwatch_metric_alarm.freeable_memory[0].arn, null)
    read_latency         = try(aws_cloudwatch_metric_alarm.read_latency[0].arn, null)
    write_latency        = try(aws_cloudwatch_metric_alarm.write_latency[0].arn, null)
  }
}
