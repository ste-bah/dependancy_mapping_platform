################################################################################
# Application Load Balancer Module - Outputs
################################################################################

#--------------------------------------------------------------
# ALB Outputs
#--------------------------------------------------------------

output "alb_id" {
  description = "ID of the Application Load Balancer"
  value       = aws_lb.main.id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_arn_suffix" {
  description = "ARN suffix of the ALB for CloudWatch metrics"
  value       = aws_lb.main.arn_suffix
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB (for Route53 alias records)"
  value       = aws_lb.main.zone_id
}

output "alb_name" {
  description = "Name of the Application Load Balancer"
  value       = aws_lb.main.name
}

#--------------------------------------------------------------
# Target Group Outputs
#--------------------------------------------------------------

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.main.arn
}

output "target_group_arn_suffix" {
  description = "ARN suffix of the target group for CloudWatch metrics"
  value       = aws_lb_target_group.main.arn_suffix
}

output "target_group_name" {
  description = "Name of the target group"
  value       = aws_lb_target_group.main.name
}

output "target_group_port" {
  description = "Port of the target group"
  value       = aws_lb_target_group.main.port
}

#--------------------------------------------------------------
# Listener Outputs
#--------------------------------------------------------------

output "https_listener_arn" {
  description = "ARN of the HTTPS listener"
  value       = aws_lb_listener.https.arn
}

output "http_listener_arn" {
  description = "ARN of the HTTP listener (redirect to HTTPS)"
  value       = aws_lb_listener.http.arn
}

#--------------------------------------------------------------
# CloudWatch Dimensions (for monitoring)
#--------------------------------------------------------------

output "cloudwatch_dimensions" {
  description = "CloudWatch dimensions for ALB metrics"
  value = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.main.arn_suffix
  }
}

#--------------------------------------------------------------
# Composite Outputs (for other modules)
#--------------------------------------------------------------

output "alb_config" {
  description = "Complete ALB configuration for use by other modules"
  value = {
    alb_arn            = aws_lb.main.arn
    alb_dns_name       = aws_lb.main.dns_name
    alb_zone_id        = aws_lb.main.zone_id
    target_group_arn   = aws_lb_target_group.main.arn
    https_listener_arn = aws_lb_listener.https.arn
    http_listener_arn  = aws_lb_listener.http.arn
    container_port     = aws_lb_target_group.main.port
    health_check_path  = var.health_check_path
  }
}
