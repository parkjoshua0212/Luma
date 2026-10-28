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
