# Bootstrap: creates the S3 bucket that stores the main config's remote state.
#
# This config deliberately uses LOCAL state (no backend block). The main config
# can't create the bucket it stores its own state in, so this runs once first.
# If the local state here is ever lost, re-adopt the bucket with:
#   terraform import aws_s3_bucket.tfstate <bucket-name>

terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "aws_profile" {
  description = "AWS CLI profile to authenticate with"
  type        = string
  default     = "luma"
}

variable "region" {
  description = "AWS region for the state bucket"
  type        = string
  default     = "ap-northeast-2"
}

provider "aws" {
  region  = var.region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project   = "luma"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "tfstate" {
  # Bucket names are global across all AWS accounts, so the account ID keeps it unique.
  bucket = "luma-tfstate-${data.aws_caller_identity.current.account_id}"

  # Losing this bucket means losing track of every resource the main config manages.
  lifecycle {
    prevent_destroy = true
  }
}

# Every state write becomes a new object version, so a bad state can be rolled back.
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

# SSE-S3 is free; KMS would add per-request cost without much benefit here.
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Reject any request not made over TLS.
resource "aws_s3_bucket_policy" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.tfstate.arn,
        "${aws_s3_bucket.tfstate.arn}/*",
      ]
      Condition = {
        Bool = { "aws:SecureTransport" = "false" }
      }
    }]
  })

  # The public access block must exist first, or a policy change can race it.
  depends_on = [aws_s3_bucket_public_access_block.tfstate]
}

# Keep old state versions for 90 days (and always the latest 10) so they don't pile up.
resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days           = 90
      newer_noncurrent_versions = 10
    }
  }

  # Lifecycle rules on noncurrent versions need versioning enabled first.
  depends_on = [aws_s3_bucket_versioning.tfstate]
}
