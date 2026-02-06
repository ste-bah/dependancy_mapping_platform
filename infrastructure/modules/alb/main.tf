################################################################################
# Application Load Balancer Module
# Internet-facing ALB with HTTPS termination for Code Reviewer
################################################################################

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  default_tags = {
    Module      = "alb"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  tags = merge(local.default_tags, var.tags)
}

################################################################################
# Application Load Balancer
################################################################################

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.security_group_id]
  subnets            = var.public_subnet_ids

  idle_timeout               = var.idle_timeout
  enable_deletion_protection = var.deletion_protection

  # Enable access logs if bucket is provided
  dynamic "access_logs" {
    for_each = var.access_logs_bucket != "" ? [1] : []
    content {
      bucket  = var.access_logs_bucket
      prefix  = "alb-logs/${local.name_prefix}"
      enabled = true
    }
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-alb"
  })
}

################################################################################
# Target Group
################################################################################

resource "aws_lb_target_group" "main" {
  name                 = "${local.name_prefix}-tg"
  port                 = var.container_port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = var.deregistration_delay

  health_check {
    enabled             = true
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    interval            = var.health_check_interval
    timeout             = var.health_check_timeout
    healthy_threshold   = var.health_check_healthy_threshold
    unhealthy_threshold = var.health_check_unhealthy_threshold
    matcher             = var.health_check_matcher
  }

  stickiness {
    type    = "lb_cookie"
    enabled = false
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-tg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

################################################################################
# HTTPS Listener (Port 443)
################################################################################

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = var.ssl_policy
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-https-listener"
  })
}

################################################################################
# HTTP Listener (Port 80) - Redirect to HTTPS
################################################################################

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-http-listener"
  })
}

################################################################################
# Additional HTTPS Listener Rules (Optional)
################################################################################

# Health check bypass rule - allows health checks without authentication
resource "aws_lb_listener_rule" "health_check" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }

  condition {
    path_pattern {
      values = ["/health/*", "/health"]
    }
  }

  tags = local.tags
}

################################################################################
# Additional Certificate Attachments (Optional)
################################################################################

resource "aws_lb_listener_certificate" "additional" {
  count = length(var.additional_certificate_arns)

  listener_arn    = aws_lb_listener.https.arn
  certificate_arn = var.additional_certificate_arns[count.index]
}
