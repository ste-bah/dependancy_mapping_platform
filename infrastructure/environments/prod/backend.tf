#------------------------------------------------------------------------------
# Terraform Backend Configuration - Production Environment
#
# IMPORTANT: Before running terraform init, replace the placeholder values:
#   1. REPLACE-terraform-state-bucket -> Your S3 bucket name for state storage
#   2. REPLACE-terraform-locks -> Your DynamoDB table name for state locking
#
# Production backend should have:
#   - Versioning enabled on S3 bucket
#   - Encryption at rest (AES-256 or KMS)
#   - Access logging enabled
#   - MFA delete enabled (recommended)
#   - Cross-region replication (recommended)
#
# To create the backend resources, you can use:
#   aws s3 mb s3://your-terraform-state-bucket
#   aws s3api put-bucket-versioning \
#     --bucket your-terraform-state-bucket \
#     --versioning-configuration Status=Enabled
#   aws s3api put-bucket-encryption \
#     --bucket your-terraform-state-bucket \
#     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
#   aws dynamodb create-table \
#     --table-name your-terraform-locks \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --tags Key=Environment,Value=production
#------------------------------------------------------------------------------

terraform {
  backend "s3" {
    bucket         = "REPLACE-terraform-state-bucket"
    key            = "dependency-mapping-platform/prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "REPLACE-terraform-locks"
  }
}
