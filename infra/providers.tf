terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7" # 3.7 added ephemeral random_password
    }
  }

  # The bucket comes from infra/bootstrap. Backend blocks can't reference
  # variables, so these values are literals and must match the bootstrap outputs.
  backend "s3" {
    bucket  = "luma-tfstate-622056304769"
    key     = "luma/terraform.tfstate"
    region  = "ap-northeast-2"
    profile = "luma"
    encrypt = true

    # S3-native locking (a .tflock object next to the state); no DynamoDB table needed.
    use_lockfile = true
  }
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
