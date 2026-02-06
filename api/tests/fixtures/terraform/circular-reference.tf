# Circular Reference Fixture
# Tests detection of circular dependencies (should be flagged as warning)
#
# Expected: Graph validator should detect cycle: sg1 -> sg2 -> sg1

terraform {
  required_version = ">= 1.0.0"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name = "circular-test-vpc"
  }
}

# Security group 1 references security group 2
resource "aws_security_group" "sg1" {
  name        = "sg1"
  description = "Security group 1"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.sg2.id]
  }

  tags = {
    Name = "sg1"
  }
}

# Security group 2 references security group 1 (creating a cycle)
resource "aws_security_group" "sg2" {
  name        = "sg2"
  description = "Security group 2"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.sg1.id]
  }

  tags = {
    Name = "sg2"
  }
}

# Note: This configuration will cause a Terraform error due to the circular dependency.
# It's included here for testing the cycle detection capabilities of the graph validator.
