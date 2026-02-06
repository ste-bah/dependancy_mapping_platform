#------------------------------------------------------------------------------
# VPC Module - Code Reviewer Infrastructure
# Production-ready VPC with 3-tier subnet architecture (public, private, database)
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

  # Determine number of NAT gateways based on configuration
  nat_gateway_count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.azs)) : 0

  common_tags = merge(var.tags, {
    Module      = "vpc"
    Environment = var.environment
  })
}

#------------------------------------------------------------------------------
# VPC
#------------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

#------------------------------------------------------------------------------
# Internet Gateway
#------------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

#------------------------------------------------------------------------------
# Public Subnets (for ALB)
#------------------------------------------------------------------------------
resource "aws_subnet" "public" {
  count = length(var.azs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${var.azs[count.index]}"
    Type = "public"
    Tier = "public"
  })
}

#------------------------------------------------------------------------------
# Private Subnets (for ECS tasks)
#------------------------------------------------------------------------------
resource "aws_subnet" "private" {
  count = length(var.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-${var.azs[count.index]}"
    Type = "private"
    Tier = "application"
  })
}

#------------------------------------------------------------------------------
# Database Subnets (for RDS, ElastiCache)
#------------------------------------------------------------------------------
resource "aws_subnet" "database" {
  count = length(var.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.database_subnet_cidrs[count.index]
  availability_zone = var.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-${var.azs[count.index]}"
    Type = "database"
    Tier = "data"
  })
}

#------------------------------------------------------------------------------
# Elastic IPs for NAT Gateways
#------------------------------------------------------------------------------
resource "aws_eip" "nat" {
  count = local.nat_gateway_count

  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

#------------------------------------------------------------------------------
# NAT Gateways
#------------------------------------------------------------------------------
resource "aws_nat_gateway" "main" {
  count = local.nat_gateway_count

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

#------------------------------------------------------------------------------
# Public Route Table
#------------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
    Type = "public"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count = length(var.azs)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

#------------------------------------------------------------------------------
# Private Route Tables (one per AZ if multiple NAT gateways, otherwise shared)
#------------------------------------------------------------------------------
resource "aws_route_table" "private" {
  count = var.single_nat_gateway ? 1 : length(var.azs)

  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = var.single_nat_gateway ? "${local.name_prefix}-private-rt" : "${local.name_prefix}-private-rt-${var.azs[count.index]}"
    Type = "private"
  })
}

resource "aws_route" "private_nat" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.azs)) : 0

  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = var.single_nat_gateway ? aws_nat_gateway.main[0].id : aws_nat_gateway.main[count.index].id
}

resource "aws_route_table_association" "private" {
  count = length(var.azs)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = var.single_nat_gateway ? aws_route_table.private[0].id : aws_route_table.private[count.index].id
}

#------------------------------------------------------------------------------
# Database Route Table (isolated - no internet access)
#------------------------------------------------------------------------------
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-rt"
    Type = "database"
  })
}

resource "aws_route_table_association" "database" {
  count = length(var.azs)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

#------------------------------------------------------------------------------
# DB Subnet Group for RDS
#------------------------------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Database subnet group for ${var.project_name} ${var.environment}"
  subnet_ids  = aws_subnet.database[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

#------------------------------------------------------------------------------
# ElastiCache Subnet Group
#------------------------------------------------------------------------------
resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name_prefix}-cache-subnet-group"
  description = "ElastiCache subnet group for ${var.project_name} ${var.environment}"
  subnet_ids  = aws_subnet.database[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cache-subnet-group"
  })
}

#------------------------------------------------------------------------------
# VPC Flow Logs (optional but recommended for production)
#------------------------------------------------------------------------------
resource "aws_flow_log" "main" {
  count = var.enable_flow_logs ? 1 : 0

  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  iam_role_arn             = var.flow_logs_role_arn
  log_destination_type     = "cloud-watch-logs"
  log_destination          = var.flow_logs_log_group_arn
  max_aggregation_interval = 60

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-flow-logs"
  })
}

#------------------------------------------------------------------------------
# Default Security Group - Restrict all traffic
#------------------------------------------------------------------------------
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  # No ingress or egress rules - effectively disables the default SG

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-default-sg-restricted"
  })
}

#------------------------------------------------------------------------------
# Default Network ACL - Allow all (controlled at SG level)
#------------------------------------------------------------------------------
resource "aws_default_network_acl" "default" {
  default_network_acl_id = aws_vpc.main.default_network_acl_id

  ingress {
    protocol   = -1
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  egress {
    protocol   = -1
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-default-nacl"
  })

  lifecycle {
    ignore_changes = [subnet_ids]
  }
}
