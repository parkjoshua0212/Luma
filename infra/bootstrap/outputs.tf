output "state_bucket_name" {
  description = "Bucket name to put in the main config's backend block"
  value       = aws_s3_bucket.tfstate.id
}

output "region" {
  description = "Region of the state bucket"
  value       = var.region
}
