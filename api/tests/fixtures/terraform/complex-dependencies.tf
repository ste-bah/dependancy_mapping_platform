# Complex Dependencies Fixture
# Tests multi-level dependencies, data sources, locals, and various reference types
#
# Expected: Complex graph with multiple dependency chains and reference types

terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "environment" {
  type        = string
  description = "Environment name"
  default     = "production"
}

variable "instance_count" {
  type        = number
  description = "Number of instances to create"
  default     = 3
}

variable "allowed_cidrs" {
  type        = list(string)
  description = "CIDR blocks allowed for ingress"
  default     = ["10.0.0.0/8"]
}

variable "tags" {
  type        = map(string)
  description = "Common tags for all resources"
  default     = {}
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_caller_identity" "current" {}

# Locals with complex expressions
locals {
  name_prefix = "${var.environment}-app"

  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    AccountId   = data.aws_caller_identity.current.account_id
  })

  azs = slice(data.aws_availability_zones.available.names, 0, 3)

  subnet_cidrs = [for i, az in local.azs : cidrsubnet("10.0.0.0/16", 8, i)]

  instance_names = [for i in range(var.instance_count) : "${local.name_prefix}-${i}"]
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# Subnets with for_each
resource "aws_subnet" "public" {
  for_each = toset(local.azs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.subnet_cidrs[index(local.azs, each.key)]
  availability_zone       = each.key
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${each.key}"
    Type = "public"
  })
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# Security Group
resource "aws_security_group" "app" {
  name        = "${local.name_prefix}-sg"
  description = "Security group for application servers"
  vpc_id      = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.allowed_cidrs
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# IAM Role
resource "aws_iam_role" "app" {
  name = "${local.name_prefix}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "app" {
  name = "${local.name_prefix}-profile"
  role = aws_iam_role.app.name
}

# Launch Template
resource "aws_launch_template" "app" {
  name_prefix   = local.name_prefix
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.app.id]
  }

  tag_specifications {
    resource_type = "instance"
    tags          = local.common_tags
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo "Hello from ${var.environment}"
  EOF
  )
}

# EC2 Instances with count
resource "aws_instance" "app" {
  count = var.instance_count

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  subnet_id = element([for s in aws_subnet.public : s.id], count.index % length(aws_subnet.public))

  tags = merge(local.common_tags, {
    Name = local.instance_names[count.index]
  })

  depends_on = [
    aws_internet_gateway.main,
    aws_route_table_association.public
  ]
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "subnet_ids" {
  description = "Public subnet IDs"
  value       = [for s in aws_subnet.public : s.id]
}

output "instance_ids" {
  description = "EC2 instance IDs"
  value       = aws_instance.app[*].id
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.app.id
}
