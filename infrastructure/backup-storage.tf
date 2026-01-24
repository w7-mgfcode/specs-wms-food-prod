# FlowViz Backup Storage - Terraform Configuration
# infrastructure/backup-storage.tf
# S3 buckets for PostgreSQL backups with lifecycle policies and cross-region replication

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# === Variables ===
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "dr_region" {
  description = "Disaster recovery region"
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "flowviz"
}

# === Providers ===
provider "aws" {
  region = var.region
  alias  = "primary"
}

provider "aws" {
  region = var.dr_region
  alias  = "dr"
}

# === Primary Backup Bucket ===
resource "aws_s3_bucket" "backup_primary" {
  provider = aws.primary
  bucket   = "${var.project_name}-backups-${var.environment}-${var.region}"

  tags = {
    Name        = "${var.project_name}-backups"
    Environment = var.environment
    Purpose     = "postgresql-backup"
    Compliance  = "HACCP"
  }
}

# Enable versioning (required for replication)
resource "aws_s3_bucket_versioning" "backup_primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "backup_primary" {
  provider                = aws.primary
  bucket                  = aws_s3_bucket.backup_primary.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Lifecycle rules for daily and weekly backups
resource "aws_s3_bucket_lifecycle_configuration" "backup_primary" {
  provider = aws.primary
  bucket   = aws_s3_bucket.backup_primary.id

  # Daily backups - 90 day retention
  rule {
    id     = "daily-backup-lifecycle"
    status = "Enabled"

    filter {
      prefix = "daily/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 60
      storage_class = "GLACIER"
    }

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  # Weekly backups - 7 year HACCP retention
  rule {
    id     = "weekly-backup-lifecycle"
    status = "Enabled"

    filter {
      prefix = "weekly/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 2555  # ~7 years for HACCP compliance
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# === DR Bucket (Cross-Region) ===
resource "aws_s3_bucket" "backup_dr" {
  provider = aws.dr
  bucket   = "${var.project_name}-backups-${var.environment}-${var.dr_region}"

  tags = {
    Name        = "${var.project_name}-backups-dr"
    Environment = var.environment
    Purpose     = "postgresql-backup-dr"
    Compliance  = "HACCP"
  }
}

# Enable versioning on DR bucket (required for replication)
resource "aws_s3_bucket_versioning" "backup_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.backup_dr.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Block public access on DR bucket
resource "aws_s3_bucket_public_access_block" "backup_dr" {
  provider                = aws.dr
  bucket                  = aws_s3_bucket.backup_dr.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-side encryption on DR bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.backup_dr.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# === Replication Configuration ===
resource "aws_iam_role" "replication" {
  provider = aws.primary
  name     = "${var.project_name}-backup-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "replication" {
  provider = aws.primary
  name     = "${var.project_name}-backup-replication-policy"
  role     = aws_iam_role.replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.backup_primary.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = "${aws_s3_bucket.backup_primary.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = "${aws_s3_bucket.backup_dr.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_replication_configuration" "backup" {
  provider   = aws.primary
  depends_on = [aws_s3_bucket_versioning.backup_primary]
  bucket     = aws_s3_bucket.backup_primary.id
  role       = aws_iam_role.replication.arn

  rule {
    id     = "replicate-all"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.backup_dr.arn
      storage_class = "STANDARD_IA"
    }
  }
}

# === Outputs ===
output "primary_bucket_name" {
  description = "Primary backup bucket name"
  value       = aws_s3_bucket.backup_primary.id
}

output "primary_bucket_arn" {
  description = "Primary backup bucket ARN"
  value       = aws_s3_bucket.backup_primary.arn
}

output "dr_bucket_name" {
  description = "DR backup bucket name"
  value       = aws_s3_bucket.backup_dr.id
}

output "dr_bucket_arn" {
  description = "DR backup bucket ARN"
  value       = aws_s3_bucket.backup_dr.arn
}

output "replication_role_arn" {
  description = "S3 replication IAM role ARN"
  value       = aws_iam_role.replication.arn
}
