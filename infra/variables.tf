variable "aws_profile" {
  description = "AWS CLI profile to authenticate with"
  type        = string
  default     = "luma"
}

variable "region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-northeast-2"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC; subnets are carved out of it as /24s"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_deletion_protection" {
  description = "Block deletion of the RDS instance; off so terraform destroy works between sessions"
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip the RDS final snapshot on destroy; set false (and apply) before a destroy you want a snapshot of"
  type        = bool
  default     = true
}

variable "db_password_version" {
  description = "Bump to generate a new DB password and push it to RDS and SSM"
  type        = number
  default     = 1
}
