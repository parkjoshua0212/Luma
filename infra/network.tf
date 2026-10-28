# Two-tier VPC across two AZs:
#   public  - app compute; reaches the internet (Gemini API, image pulls) via the IGW
#   private - database only; no route out of the VPC at all
#
# There is deliberately no NAT gateway. It costs ~$35+/month even idle, which would
# dwarf everything else here. App tasks get a public IP instead and are locked down
# by their security group. If the app ever moves to private subnets, add a NAT
# gateway (or VPC endpoints) and a 0.0.0.0/0 route on the private route table.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  # RDS subnet groups require at least two AZs; two is enough for this project.
  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  # Keyed by AZ name so adding or reordering AZs doesn't renumber existing subnets.
  public_subnets  = { for i, az in local.azs : az => cidrsubnet(var.vpc_cidr, 8, i) }      # 10.0.0.0/24, 10.0.1.0/24
  private_subnets = { for i, az in local.azs : az => cidrsubnet(var.vpc_cidr, 8, i + 10) } # 10.0.10.0/24, 10.0.11.0/24
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # Both are needed for RDS endpoint hostnames to resolve inside the VPC.
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "luma" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "luma" }
}

# --- Public tier -----------------------------------------------------------------

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value

  # Left off on purpose: whatever runs here must ask for a public IP explicitly
  # (e.g. assign_public_ip on an ECS service), so nothing becomes reachable by accident.
  map_public_ip_on_launch = false

  tags = { Name = "luma-public-${each.key}", Tier = "public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "luma-public" }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# --- Private tier ----------------------------------------------------------------

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value

  tags = { Name = "luma-private-${each.key}", Tier = "private" }
}

# Only the implicit local route: private subnets can talk within the VPC and nowhere else.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "luma-private" }
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}

# --- Default security group --------------------------------------------------------

# Strip the default SG's allow-all rules so a resource launched without an explicit
# SG gets no access instead of full access. Terraform adopts it rather than creating it.
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "luma-default-locked" }
}
