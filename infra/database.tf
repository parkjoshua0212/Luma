# PostgreSQL on RDS, in the private subnets with no public endpoint.
#
# The master password never touches Terraform state: it is an ephemeral value fed
# to write-only arguments on both the DB instance and an SSM SecureString. The app
# reads it from SSM. To rotate, bump var.db_password_version and apply.

ephemeral "random_password" "db" {
  length = 40
  # RDS rejects / @ " and spaces; letters and digits alone at this length are plenty.
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "luma"
  subnet_ids = [for s in aws_subnet.private : s.id]

  tags = { Name = "luma" }
}

# No ingress here: the compute config adds a 5432 rule sourced from the app's SG,
# so only the app can reach the database.
resource "aws_security_group" "db" {
  name        = "luma-db"
  description = "PostgreSQL access for the Luma API"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "luma-db" }
}

resource "aws_db_instance" "main" {
  identifier = "luma"

  engine = "postgres"
  # Pinned to the exact version Neon runs, so the data migration is like-for-like.
  # RDS's default for a bare "18" is an older minor. Auto minor upgrades are off
  # because an AWS-side upgrade would make Terraform try to downgrade on next plan.
  engine_version             = "18.6"
  auto_minor_version_upgrade = false

  # Smallest Graviton class, free-tier eligible.
  instance_class        = "db.t4g.micro"
  allocated_storage     = 20
  max_allocated_storage = 0 # no autoscaling: storage growth should be a deliberate choice
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name             = "luma"
  username            = "luma"
  password_wo         = ephemeral.random_password.db.result
  password_wo_version = var.db_password_version

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false # standby would double the cost; downtime on AZ failure is acceptable here

  # RDS for PostgreSQL 15+ already sets rds.force_ssl=1 in the default parameter group.

  backup_retention_period = 7
  backup_window           = "17:00-18:00"         # 02:00-03:00 KST
  maintenance_window      = "sun:18:30-sun:19:30" # Mon 03:30-04:30 KST
  copy_tags_to_snapshot   = true

  deletion_protection = var.db_deletion_protection

  # The provider reads these from state at delete time, so changing them takes an
  # apply before the destroy; passing -var to terraform destroy alone has no effect.
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "luma-final-${random_id.final_snapshot.hex}"

  tags = { Name = "luma" }
}

# Unique suffix for the final snapshot name. It is regenerated whenever the stack is
# recreated, so destroying again next session doesn't collide with an old snapshot.
resource "random_id" "final_snapshot" {
  byte_length = 4
}

resource "aws_ssm_parameter" "db_password" {
  name        = "/luma/db/password"
  description = "Master password for the luma RDS instance"
  type        = "SecureString" # encrypted with the AWS-managed aws/ssm key, no KMS cost

  value_wo         = ephemeral.random_password.db.result
  value_wo_version = var.db_password_version
}
