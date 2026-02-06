#------------------------------------------------------------------------------
# S3 Module - Code Reviewer Infrastructure
# Creates 3 buckets: repos, scans, temp with proper security and lifecycle rules
#------------------------------------------------------------------------------

locals {
  bucket_names = {
    repos = "${var.project_name}-${var.environment}-repos"
    scans = "${var.project_name}-${var.environment}-scans"
    temp  = "${var.project_name}-${var.environment}-temp"
  }

  common_tags = merge(var.tags, {
    Module = "s3"
  })
}

#------------------------------------------------------------------------------
# Repos Bucket - Repository clones storage
#------------------------------------------------------------------------------
resource "aws_s3_bucket" "repos" {
  bucket        = local.bucket_names.repos
  force_destroy = var.force_destroy

  tags = merge(local.common_tags, {
    Name    = local.bucket_names.repos
    Purpose = "repository-clones"
  })
}

resource "aws_s3_bucket_versioning" "repos" {
  bucket = aws_s3_bucket.repos.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "repos" {
  bucket = aws_s3_bucket.repos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "repos" {
  bucket = aws_s3_bucket.repos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "repos" {
  bucket = aws_s3_bucket.repos.id

  rule {
    id     = "expire-temp-prefix"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

#------------------------------------------------------------------------------
# Scans Bucket - Scan results and artifacts
#------------------------------------------------------------------------------
resource "aws_s3_bucket" "scans" {
  bucket        = local.bucket_names.scans
  force_destroy = var.force_destroy

  tags = merge(local.common_tags, {
    Name    = local.bucket_names.scans
    Purpose = "scan-results"
  })
}

resource "aws_s3_bucket_versioning" "scans" {
  bucket = aws_s3_bucket.scans.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "scans" {
  bucket = aws_s3_bucket.scans.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "scans" {
  bucket = aws_s3_bucket.scans.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "scans" {
  bucket = aws_s3_bucket.scans.id

  rule {
    id     = "transition-and-expire"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 90
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

#------------------------------------------------------------------------------
# Temp Bucket - Temporary processing files
#------------------------------------------------------------------------------
resource "aws_s3_bucket" "temp" {
  bucket        = local.bucket_names.temp
  force_destroy = var.force_destroy

  tags = merge(local.common_tags, {
    Name    = local.bucket_names.temp
    Purpose = "temporary-processing"
  })
}

resource "aws_s3_bucket_versioning" "temp" {
  bucket = aws_s3_bucket.temp.id

  versioning_configuration {
    status = "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "temp" {
  bucket = aws_s3_bucket.temp.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "temp" {
  bucket = aws_s3_bucket.temp.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "temp" {
  bucket = aws_s3_bucket.temp.id

  rule {
    id     = "expire-all-daily"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 1
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
