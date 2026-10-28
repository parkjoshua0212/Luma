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
