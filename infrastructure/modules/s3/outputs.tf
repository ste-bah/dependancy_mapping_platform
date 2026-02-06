#------------------------------------------------------------------------------
# S3 Module Outputs
#------------------------------------------------------------------------------

# Repos Bucket Outputs
output "repos_bucket_id" {
  description = "ID of the repos S3 bucket"
  value       = aws_s3_bucket.repos.id
}

output "repos_bucket_arn" {
  description = "ARN of the repos S3 bucket"
  value       = aws_s3_bucket.repos.arn
}

output "repos_bucket_domain_name" {
  description = "Domain name of the repos S3 bucket"
  value       = aws_s3_bucket.repos.bucket_domain_name
}

# Scans Bucket Outputs
output "scans_bucket_id" {
  description = "ID of the scans S3 bucket"
  value       = aws_s3_bucket.scans.id
}

output "scans_bucket_arn" {
  description = "ARN of the scans S3 bucket"
  value       = aws_s3_bucket.scans.arn
}

output "scans_bucket_domain_name" {
  description = "Domain name of the scans S3 bucket"
  value       = aws_s3_bucket.scans.bucket_domain_name
}

# Temp Bucket Outputs
output "temp_bucket_id" {
  description = "ID of the temp S3 bucket"
  value       = aws_s3_bucket.temp.id
}

output "temp_bucket_arn" {
  description = "ARN of the temp S3 bucket"
  value       = aws_s3_bucket.temp.arn
}

output "temp_bucket_domain_name" {
  description = "Domain name of the temp S3 bucket"
  value       = aws_s3_bucket.temp.bucket_domain_name
}

# Aggregated Outputs
output "all_bucket_arns" {
  description = "List of all S3 bucket ARNs (for IAM policies)"
  value = [
    aws_s3_bucket.repos.arn,
    aws_s3_bucket.scans.arn,
    aws_s3_bucket.temp.arn
  ]
}

output "all_bucket_ids" {
  description = "List of all S3 bucket IDs"
  value = [
    aws_s3_bucket.repos.id,
    aws_s3_bucket.scans.id,
    aws_s3_bucket.temp.id
  ]
}

output "bucket_arns_with_objects" {
  description = "List of bucket ARNs with /* suffix for object-level IAM policies"
  value = [
    "${aws_s3_bucket.repos.arn}/*",
    "${aws_s3_bucket.scans.arn}/*",
    "${aws_s3_bucket.temp.arn}/*"
  ]
}
