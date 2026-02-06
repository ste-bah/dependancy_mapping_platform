#------------------------------------------------------------------------------
# Outputs for Security Groups Module
# These outputs are consumed by downstream modules: ALB, ECS, RDS, ElastiCache, IAM
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# ALB Security Group Outputs
#------------------------------------------------------------------------------
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "alb_security_group_arn" {
  description = "ARN of the ALB security group"
  value       = aws_security_group.alb.arn
}

output "alb_security_group_name" {
  description = "Name of the ALB security group"
  value       = aws_security_group.alb.name
}

#------------------------------------------------------------------------------
# ECS Security Group Outputs
#------------------------------------------------------------------------------
output "ecs_security_group_id" {
  description = "ID of the ECS tasks security group"
  value       = aws_security_group.ecs.id
}

output "ecs_security_group_arn" {
  description = "ARN of the ECS tasks security group"
  value       = aws_security_group.ecs.arn
}

output "ecs_security_group_name" {
  description = "Name of the ECS tasks security group"
  value       = aws_security_group.ecs.name
}

#------------------------------------------------------------------------------
# RDS Security Group Outputs
#------------------------------------------------------------------------------
output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "rds_security_group_arn" {
  description = "ARN of the RDS security group"
  value       = aws_security_group.rds.arn
}

output "rds_security_group_name" {
  description = "Name of the RDS security group"
  value       = aws_security_group.rds.name
}

#------------------------------------------------------------------------------
# ElastiCache Security Group Outputs
#------------------------------------------------------------------------------
output "elasticache_security_group_id" {
  description = "ID of the ElastiCache security group"
  value       = aws_security_group.elasticache.id
}

output "elasticache_security_group_arn" {
  description = "ARN of the ElastiCache security group"
  value       = aws_security_group.elasticache.arn
}

output "elasticache_security_group_name" {
  description = "Name of the ElastiCache security group"
  value       = aws_security_group.elasticache.name
}

#------------------------------------------------------------------------------
# Aggregated Outputs (for convenience)
#------------------------------------------------------------------------------
output "all_security_group_ids" {
  description = "Map of all security group IDs"
  value = {
    alb         = aws_security_group.alb.id
    ecs         = aws_security_group.ecs.id
    rds         = aws_security_group.rds.id
    elasticache = aws_security_group.elasticache.id
  }
}
