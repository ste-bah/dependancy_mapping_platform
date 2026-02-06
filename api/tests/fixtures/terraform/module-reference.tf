# Module Reference Fixture
# Tests module source parsing, version constraints, and module dependencies
#
# Expected nodes: module.vpc, module.eks, aws_instance.bastion
# Expected edges: module.eks -> module.vpc, aws_instance.bastion -> module.vpc

terraform {
  required_version = ">= 1.0.0"
}

# Local module reference
module "vpc" {
  source = "./modules/vpc"

  name                 = "production-vpc"
  cidr                 = "10.0.0.0/16"
  azs                  = ["us-west-2a", "us-west-2b", "us-west-2c"]
  private_subnets      = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets       = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = false
  enable_dns_hostnames = true

  tags = {
    Environment = "production"
    Terraform   = "true"
  }
}

# Registry module with version constraint
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "production-cluster"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    default = {
      min_size     = 1
      max_size     = 10
      desired_size = 3

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"
    }
  }

  tags = {
    Environment = "production"
    Terraform   = "true"
  }
}

# GitHub module source
module "security_group" {
  source = "github.com/terraform-aws-modules/terraform-aws-security-group?ref=v5.1.0"

  name        = "bastion-sg"
  description = "Security group for bastion host"
  vpc_id      = module.vpc.vpc_id

  ingress_cidr_blocks = ["0.0.0.0/0"]
  ingress_rules       = ["ssh-tcp"]
  egress_rules        = ["all-all"]
}

# Resource depending on module outputs
resource "aws_instance" "bastion" {
  ami                    = "ami-0c55b159cbfafe1f0"
  instance_type          = "t3.micro"
  subnet_id              = module.vpc.public_subnets[0]
  vpc_security_group_ids = [module.security_group.security_group_id]

  tags = {
    Name = "bastion-host"
  }
}

# Outputs referencing module outputs
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "bastion_public_ip" {
  value = aws_instance.bastion.public_ip
}
