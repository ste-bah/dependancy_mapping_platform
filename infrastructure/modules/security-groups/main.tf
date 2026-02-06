#------------------------------------------------------------------------------
# Security Groups Module - Code Reviewer Infrastructure
# Defines security groups for ALB, ECS, RDS, and ElastiCache with minimal access
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
    Module      = "security-groups"
    Environment = var.environment
  })
}

#------------------------------------------------------------------------------
# ALB Security Group
# Allows inbound HTTPS/HTTP from internet, outbound to VPC only
#------------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
    Tier = "public"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "alb_ingress_https" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow HTTPS from internet"
  security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "alb_ingress_http" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow HTTP from internet (for redirect to HTTPS)"
  security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "alb_egress_ecs" {
  type                     = "egress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  description              = "Allow traffic to ECS tasks on application port"
  security_group_id        = aws_security_group.alb.id
}

#------------------------------------------------------------------------------
# ECS Tasks Security Group
# Allows inbound from ALB, outbound to AWS APIs, RDS, and ElastiCache
#------------------------------------------------------------------------------
resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-sg"
    Tier = "application"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "ecs_ingress_alb" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  description              = "Allow traffic from ALB on application port"
  security_group_id        = aws_security_group.ecs.id
}

resource "aws_security_group_rule" "ecs_egress_https" {
  type              = "egress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow HTTPS to AWS APIs and GitHub"
  security_group_id = aws_security_group.ecs.id
}

resource "aws_security_group_rule" "ecs_egress_rds" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
  description              = "Allow PostgreSQL traffic to RDS"
  security_group_id        = aws_security_group.ecs.id
}

resource "aws_security_group_rule" "ecs_egress_elasticache" {
  type                     = "egress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.elasticache.id
  description              = "Allow Redis traffic to ElastiCache"
  security_group_id        = aws_security_group.ecs.id
}

#------------------------------------------------------------------------------
# RDS Security Group
# Allows inbound from ECS only, no outbound needed
#------------------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
    Tier = "data"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "rds_ingress_ecs" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  description              = "Allow PostgreSQL from ECS tasks"
  security_group_id        = aws_security_group.rds.id
}

#------------------------------------------------------------------------------
# ElastiCache Security Group
# Allows inbound from ECS only, no outbound needed
#------------------------------------------------------------------------------
resource "aws_security_group" "elasticache" {
  name        = "${local.name_prefix}-elasticache-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-elasticache-sg"
    Tier = "data"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "elasticache_ingress_ecs" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  description              = "Allow Redis from ECS tasks"
  security_group_id        = aws_security_group.elasticache.id
}
