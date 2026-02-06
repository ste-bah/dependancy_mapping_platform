# ALB Module

This module creates an internet-facing Application Load Balancer with HTTPS termination for the Code Reviewer application.

## Features

- Internet-facing Application Load Balancer
- HTTPS listener with TLS 1.3 security policy
- HTTP to HTTPS redirect (301)
- IP-based target group for Fargate
- Configurable health checks
- Optional access logging to S3
- Multiple certificate support

## Usage

```hcl
module "alb" {
  source = "../modules/alb"

  project_name      = "code-reviewer"
  environment       = "prod"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  security_group_id = module.security_groups.alb_security_group_id
  certificate_arn   = "arn:aws:acm:us-east-1:123456789012:certificate/abc123"

  # Optional
  container_port      = 3000
  health_check_path   = "/health/live"
  deletion_protection = true
  access_logs_bucket  = module.s3.logs_bucket_name

  tags = {
    Team = "platform"
  }
}
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.5.0 |
| aws | >= 5.0.0 |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| project_name | Name of the project | `string` | n/a | yes |
| environment | Environment name | `string` | n/a | yes |
| vpc_id | VPC ID | `string` | n/a | yes |
| public_subnet_ids | List of public subnet IDs | `list(string)` | n/a | yes |
| security_group_id | Security group ID for ALB | `string` | n/a | yes |
| certificate_arn | ACM certificate ARN | `string` | n/a | yes |
| container_port | Container port | `number` | `3000` | no |
| health_check_path | Health check path | `string` | `"/health/live"` | no |
| deletion_protection | Enable deletion protection | `bool` | `true` | no |
| access_logs_bucket | S3 bucket for access logs | `string` | `""` | no |

## Outputs

| Name | Description |
|------|-------------|
| alb_arn | ARN of the ALB |
| alb_dns_name | DNS name of the ALB |
| alb_zone_id | Hosted zone ID for Route53 |
| target_group_arn | ARN of the target group |
| https_listener_arn | ARN of the HTTPS listener |
