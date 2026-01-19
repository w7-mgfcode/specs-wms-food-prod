# PRP: Production Cloud Infrastructure - AWS Terraform Deployment

> **Phase:** 8a - Cloud Infrastructure Provisioning
> **Priority:** HIGH (Production Gate)
> **Date:** January 19, 2026
> **Confidence Score:** 7/10
> **Prerequisites:** Phase 5 (Security), Phase 6 (Monitoring), Phase 7 (Infrastructure)

---

## Purpose

Deploy the Food Production WMS FlowViz to production-ready AWS infrastructure with high availability, zero-downtime deployments, and enterprise-grade security. This PRP provides Infrastructure-as-Code (Terraform) for provisioning a complete multi-AZ AWS environment with:

1. **VPC & Networking**: Multi-AZ VPC with public/private/database subnets, NAT Gateway
2. **Compute**: Auto Scaling Group with EC2 instances for FastAPI backend
3. **Database**: RDS PostgreSQL 17 with Multi-AZ, encryption, automated backups
4. **Cache**: ElastiCache Redis (Valkey-compatible) for session/rate limiting
5. **Load Balancing**: Application Load Balancer with SSL termination and blue-green deployment
6. **Secrets Management**: AWS Secrets Manager for secure credential storage
7. **Monitoring**: CloudWatch Logs, alarms, and Performance Insights

---

## Why

### Business Requirements
- **Zero-Downtime Deployments**: Blue-green deployment strategy prevents service interruption
- **High Availability**: 99.99% uptime SLA with Multi-AZ architecture
- **HACCP Compliance**: Secure, auditable infrastructure for food traceability
- **Scalability**: Auto-scaling to handle production load (up to 4 instances)

### Technical Requirements
- **Infrastructure-as-Code**: All resources reproducible via Terraform
- **Security Posture**: TLS 1.3, private subnets, least-privilege IAM, encrypted storage
- **Cost Optimization**: ~$210/month estimated AWS cost for production environment
- **Disaster Recovery**: 7-day backup retention with point-in-time recovery

---

## Success Criteria

- [ ] VPC with 2 AZs, public/private/database subnets provisioned via Terraform
- [ ] RDS PostgreSQL 17 with Multi-AZ, encryption, automated backups (7 days)
- [ ] ElastiCache Redis cluster for rate limiting and session storage
- [ ] Application Load Balancer with SSL/TLS 1.3 termination
- [ ] Blue-green target groups configured with health checks
- [ ] Auto Scaling Group (min 2, max 4 instances) in private subnets
- [ ] AWS Secrets Manager storing production credentials
- [ ] CloudWatch Logs for application and infrastructure monitoring
- [ ] Terraform state stored in S3 with DynamoDB locking
- [ ] All security groups follow least-privilege principle
- [ ] Health check endpoint `/api/health` returns 200 before traffic shift
- [ ] Zero-downtime deployment validated via blue-green switch

---

## All Needed Context

### Existing Infrastructure Patterns

#### Current Docker Compose (`backend/docker/docker-compose.yml`)

The current development stack runs:
- **PostgreSQL 17**: `postgres:17-alpine` on port 5433
- **Valkey 8**: `valkey/valkey:8-alpine` on port 6379 (Redis-compatible)
- **FastAPI Backend**: Custom Dockerfile exposing port 8000
- **Celery Worker**: Background task processor

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
      POSTGRES_DB: flowviz
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d flowviz"]
      interval: 5s
      timeout: 5s
      retries: 5

  valkey:
    image: valkey/valkey:8-alpine
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://admin:password@postgres:5432/flowviz
      - REDIS_URL=redis://valkey:6379/0
      - SECRET_KEY=dev-secret-key-change-in-production-min-32-chars
    depends_on:
      postgres:
        condition: service_healthy
      valkey:
        condition: service_healthy
```

**Key Takeaways**:
- Database and cache health checks are critical for service startup
- Environment variables for DATABASE_URL, REDIS_URL, SECRET_KEY
- FastAPI app runs on port 8000
- Celery requires same Redis/Valkey connection

#### Current Dockerfile (`backend/docker/Dockerfile`)

```dockerfile
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# Copy application code
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Key Takeaways**:
- Uses Python 3.12 slim base image
- Non-root user `appuser` for security
- Health check on `/api/health` endpoint
- Port 8000 for FastAPI

#### Current Configuration (`backend/app/config.py`)

```python
class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://admin:password@localhost:5432/flowviz"

    # Authentication
    secret_key: str = "INSECURE-DEV-ONLY-CHANGE-ME"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30

    # Cache (Valkey/Redis)
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"

    # Environment
    environment: str = "development"
    debug: bool = True

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    def validate_production_settings(self) -> None:
        if self.is_production:
            if "INSECURE" in self.secret_key or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be secure in production")
            if self.debug:
                raise ValueError("DEBUG must be False in production")
```

**Key Takeaways**:
- Production validation enforces secure SECRET_KEY (min 32 chars)
- DEBUG must be False in production
- CORS origins should be environment-specific
- All secrets loaded from environment variables

#### Existing Deployment Workflow (`.github/workflows/deploy-to-digitalocean.yml`)

Current CI/CD deploys to DigitalOcean via SSH:
- Git pull from main branch
- Run `python3 deploy.py --type cloud`
- Docker Compose orchestration
- Basic health check on port 8001

**Migration Path**: Replace with AWS-native deployment via GitHub Actions + Terraform + ALB target group switching.

---

### External Documentation & Research

#### Terraform AWS VPC Best Practices

**Source**: [AWS Infrastructure as Code: Multi-AZ VPC](https://medium.com/@s.u.gawande/aws-infrastructure-as-code-designing-a-multi-az-vpc-using-terraform-d128316172d1)

**Key Principles**:
1. **Multi-AZ Architecture**: Distribute resources across 2+ availability zones for 99.99% uptime SLA
2. **Network Segmentation**: Isolated public/private/database subnets with dedicated route tables
3. **Secure Egress**: NAT Gateway enables private subnet internet access without exposure
4. **Enterprise Tagging**: Cost allocation and governance via consistent tagging strategy

**Subnet Design per AZ**:
- **Public Subnet**: Internet-facing (ALB, NAT Gateway)
- **Private Subnet**: Application tier (EC2 instances with FastAPI)
- **Database Subnet**: Isolated data layer (RDS, ElastiCache)

**Terraform Module Approach**:
Use `terraform-aws-modules/vpc/aws` (version 5.5+) for production-grade VPC with:
- Automatic route table creation
- NAT Gateway per AZ (production) or single NAT (staging)
- VPC Flow Logs for network traffic analysis
- DNS hostnames enabled for RDS endpoints

**Additional Sources**:
- [AWS VPC Module GitHub](https://github.com/aws-ia/terraform-aws-vpc)
- [Spacelift: Terraform AWS VPC Guide](https://spacelift.io/blog/terraform-aws-vpc)

---

#### AWS Application Load Balancer Blue-Green Deployment

**Source**: [AWS Official - ALB Blue-Green Deployments](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/alb-resources-for-blue-green.html)

**Blue-Green Pattern**:
1. **Two Target Groups**:
   - **Blue** (production): Current version receiving all traffic
   - **Green** (staging): New version with zero traffic
2. **Health Check Validation**: Green tasks must pass health checks before traffic shift
3. **Gradual Traffic Shift**: Optional canary deployment (10% → 50% → 100%)
4. **Instant Rollback**: Switch listener back to blue target group if issues detected

**Health Check Configuration**:
```hcl
health_check {
  enabled             = true
  healthy_threshold   = 2        # Pass 2 checks to be healthy
  interval            = 30       # Check every 30s
  matcher             = "200"    # HTTP 200 OK
  path                = "/api/health"
  timeout             = 5        # 5s timeout per check
  unhealthy_threshold = 3        # Fail 3 checks to be unhealthy
}
```

**Deregistration Delay**: 30 seconds connection draining before removing instances

**Additional Sources**:
- [HashiCorp: Blue-Green Deployments Tutorial](https://developer.hashicorp.com/terraform/tutorials/aws/blue-green-canary-tests-deployments)
- [AWS DevOps Blog: Fine-tuning Blue-Green](https://aws.amazon.com/blogs/devops/blue-green-deployments-with-application-load-balancer/)

---

#### RDS PostgreSQL 17 Production Best Practices

**Source**: [Spacelift: Terraform AWS RDS Guide](https://spacelift.io/blog/terraform-aws-rds)

**Encryption at Rest**:
```hcl
storage_encrypted = true
kms_key_id        = aws_kms_key.rds.arn  # Customer-managed KMS key
```
All automated backups, read replicas, and snapshots inherit encryption.

**Encryption in Transit**:
PostgreSQL natively supports SSL/TLS. Set `rds.force_ssl = 1` in parameter group to require encrypted connections.

**Backup Configuration**:
```hcl
backup_retention_period     = 7         # 7-day retention (max 35 for compliance)
backup_window              = "03:00-04:00"  # Off-peak hours (UTC)
preferred_maintenance_window = "sun:04:00-sun:05:00"
```

**High Availability**:
```hcl
multi_az              = true   # Synchronous replication to standby
publicly_accessible   = false  # Private subnet only
deletion_protection   = true   # Prevent accidental deletion
```

**Performance Insights**:
```hcl
performance_insights_enabled = true
```
7-day query performance monitoring at no extra cost.

**Additional Sources**:
- [AWS Prescriptive Guidance: RDS Encryption](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/enable-encrypted-connections-for-postgresql-db-instances-in-amazon-rds.html)
- [Datavail: PostgreSQL Security Best Practices](https://www.datavail.com/blog/10-best-practices-to-secure-postgresql-aws-rds-aurora/)

---

#### Terraform Remote State Management

**Best Practice**: Store Terraform state in S3 with DynamoDB state locking to prevent concurrent modifications.

```hcl
terraform {
  backend "s3" {
    bucket         = "flowviz-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

**State Bucket Requirements**:
- Versioning enabled for state rollback
- Encryption enabled (SSE-S3 or SSE-KMS)
- Bucket policy restricts access to DevOps team
- DynamoDB table with `LockID` primary key for locking

---

### Critical Gotchas & Common Pitfalls

#### 1. **RDS PostgreSQL Version Support**

**Issue**: AWS RDS may not immediately support PostgreSQL 17.x (latest)

**Mitigation**:
- Check available versions: `aws rds describe-db-engine-versions --engine postgres --query 'DBEngineVersions[].EngineVersion'`
- Fallback to PostgreSQL 16.x if 17 unavailable in target region
- Test migration path: Local PostgreSQL 17 → RDS 16 compatibility

#### 2. **Valkey vs ElastiCache Redis Compatibility**

**Issue**: ElastiCache Redis 7.1 is compatible with Valkey 8 protocol, but minor differences exist

**Mitigation**:
- Use Redis-compatible commands only (no Valkey-specific features)
- Test rate limiting (SlowAPI) and Celery with ElastiCache before production
- Connection string format: `redis://elasticache-endpoint:6379/0`

#### 3. **NAT Gateway Costs**

**Issue**: NAT Gateway costs $0.045/hour (~$32/month) + $0.045/GB data processed

**Mitigation**:
- Use single NAT Gateway for staging environment
- Production: One NAT per AZ for high availability
- Monitor data transfer costs via CloudWatch

#### 4. **ALB Health Check Failures During Startup**

**Issue**: FastAPI containers take 15-30s to start, causing health check failures

**Mitigation**:
```hcl
health_check_grace_period = 300  # 5 minutes in ASG
health_check {
  interval            = 30
  unhealthy_threshold = 3  # Allow 3 failures = 90s startup time
}
```

#### 5. **Secret Key Generation**

**Issue**: SECRET_KEY must be cryptographically secure (min 32 chars)

**Mitigation**:
```bash
# Generate secure secret
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Store in AWS Secrets Manager via Terraform
resource "aws_secretsmanager_secret_version" "secret_key" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    SECRET_KEY = random_password.secret_key.result
  })
}
```

#### 6. **RDS Master Password Rotation**

**Issue**: Cannot change RDS master password after creation without downtime

**Mitigation**:
- Store master password in Secrets Manager with rotation enabled
- Use IAM database authentication for application access
- Terraform: `password = aws_secretsmanager_secret_version.db_password.secret_string`

#### 7. **Terraform State File Sensitivity**

**Issue**: State file contains sensitive data (DB passwords, API keys)

**Mitigation**:
- NEVER commit `terraform.tfstate` to Git
- Use `.gitignore` entry: `*.tfstate*`
- Encrypt S3 backend with KMS
- Restrict S3 bucket access via IAM policies

---

## Implementation Blueprint

### Task Execution Order

1. **[CRITICAL] AWS Account Setup & IAM Roles** (Day 1)
   - Create AWS account or use existing
   - Configure AWS CLI with credentials
   - Create S3 bucket + DynamoDB table for Terraform state
   - Create IAM role for Terraform with necessary permissions

2. **Initialize Terraform Project Structure** (Day 1)
   - Create `infrastructure/` directory
   - Set up Terraform backend configuration
   - Define variables for environment-specific values
   - Create `terraform.tfvars` (DO NOT commit)

3. **Provision VPC & Networking** (Day 2)
   - Deploy Multi-AZ VPC with public/private/database subnets
   - Create Internet Gateway and NAT Gateway
   - Configure route tables and security groups
   - Enable VPC Flow Logs to CloudWatch

4. **Deploy RDS PostgreSQL** (Day 2-3)
   - Create DB subnet group in database subnets
   - Provision RDS PostgreSQL 17 (or 16) with Multi-AZ
   - Configure automated backups (7-day retention)
   - Enable encryption at rest with KMS
   - Store master password in Secrets Manager

5. **Deploy ElastiCache Redis** (Day 3)
   - Create ElastiCache subnet group
   - Provision Redis 7.1 cluster (Valkey-compatible)
   - Configure security group (allow port 6379 from private subnets)
   - Test connectivity from EC2 instance

6. **Create Application Load Balancer** (Day 3-4)
   - Deploy ALB in public subnets
   - Configure SSL/TLS certificate via ACM
   - Create blue and green target groups
   - Set up HTTPS listener with SSL policy `ELBSecurityPolicy-TLS13-1-2-2021-06`

7. **Build and Push Docker Image to ECR** (Day 4)
   - Create ECR repository for FastAPI app
   - Build Docker image from `backend/docker/Dockerfile`
   - Push to ECR with production tag
   - Configure ECR lifecycle policy (keep last 10 images)

8. **Create Launch Template & Auto Scaling Group** (Day 4-5)
   - Define EC2 launch template with user data script
   - User data: Install Docker, pull ECR image, start containers
   - Create Auto Scaling Group (min 2, max 4, desired 2)
   - Register instances with blue target group

9. **Configure AWS Secrets Manager** (Day 5)
   - Store production secrets: SECRET_KEY, DATABASE_URL, REDIS_URL
   - Grant EC2 IAM role permission to read secrets
   - Update user data script to fetch secrets on startup

10. **Database Migration & Seeding** (Day 5)
    - Create bastion host or use AWS Systems Manager Session Manager
    - Run Alembic migrations: `alembic upgrade head`
    - Seed production data if required
    - Verify schema matches expected structure

11. **Smoke Testing & Validation** (Day 5)
    - Test ALB health checks pass (all instances healthy)
    - Verify `/api/health` returns 200
    - Test authenticated endpoint: Create lot, QC decision
    - Verify traceability query works
    - Check CloudWatch Logs for errors

12. **Blue-Green Deployment Test** (Day 5)
    - Deploy updated app version to green target group
    - Wait for green instances to pass health checks
    - Switch ALB listener to green target group
    - Monitor for 15 minutes
    - Switch back to blue (rollback test)

---

### Directory Structure

```
infrastructure/
├── main.tf                  # Provider, backend, VPC module
├── alb.tf                   # Application Load Balancer, target groups, listeners
├── rds.tf                   # RDS PostgreSQL, subnet group, parameter group
├── elasticache.tf           # ElastiCache Redis cluster
├── asg.tf                   # Launch template, Auto Scaling Group
├── ecr.tf                   # ECR repository for Docker images
├── secrets.tf               # Secrets Manager for credentials
├── security_groups.tf       # All security group rules
├── iam.tf                   # IAM roles for EC2, ECS, Lambda
├── cloudwatch.tf            # CloudWatch Logs, alarms, dashboards
├── outputs.tf               # Output values (ALB DNS, RDS endpoint)
├── variables.tf             # Input variable definitions
├── terraform.tfvars         # Environment-specific values (DO NOT COMMIT)
├── scripts/
│   └── user-data.sh         # EC2 instance startup script
└── README.md                # Deployment instructions
```

---

### Pseudocode Implementation

#### Step 1: Terraform Backend Configuration (`main.tf`)

```hcl
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket         = "flowviz-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "FlowViz-WMS"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CostCenter  = "Production"
    }
  }
}

# VPC Module
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"

  name = "flowviz-${var.environment}"
  cidr = var.vpc_cidr  # Default: 10.0.0.0/16

  azs              = data.aws_availability_zones.available.names[0:2]
  private_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets   = ["10.0.101.0/24", "10.0.102.0/24"]
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"  # Cost optimization
  enable_dns_hostnames = true
  enable_dns_support   = true

  create_database_subnet_group = true

  # VPC Flow Logs
  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  flow_log_cloudwatch_log_group_retention_in_days = 7
}
```

#### Step 2: RDS PostgreSQL (`rds.tf`)

```hcl
# Generate secure random password
resource "random_password" "db_master_password" {
  length  = 32
  special = true
}

# Store password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "flowviz/${var.environment}/db-password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_master_password.result
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier = "flowviz-${var.environment}"

  # Engine
  engine         = "postgres"
  engine_version = "16.4"  # Fallback to 16 if 17 not available
  instance_class = var.environment == "production" ? "db.t3.medium" : "db.t3.micro"

  # Storage
  allocated_storage     = 100
  max_allocated_storage = 500
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  # Database
  db_name  = "flowviz"
  username = "flowviz_admin"
  password = aws_secretsmanager_secret_version.db_password.secret_string

  # Network
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  publicly_accessible    = false

  # High Availability
  multi_az = var.environment == "production"

  # Backups
  backup_retention_period      = 7
  backup_window                = "03:00-04:00"  # 3 AM UTC
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  # Security
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"

  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]
  performance_insights_enabled    = true

  # Force SSL connections
  parameter_group_name = aws_db_parameter_group.postgres.name
}

resource "aws_db_parameter_group" "postgres" {
  name   = "flowviz-${var.environment}-postgres"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

# KMS Key for RDS Encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for FlowViz RDS encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true
}

resource "aws_kms_alias" "rds" {
  name          = "alias/flowviz-rds-${var.environment}"
  target_key_id = aws_kms_key.rds.key_id
}
```

#### Step 3: Application Load Balancer (`alb.tf`)

```hcl
# Application Load Balancer
resource "aws_lb" "main" {
  name               = "flowviz-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "production"
  enable_http2               = true
  enable_cross_zone_load_balancing = true

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    enabled = true
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue.arn
  }
}

# HTTP to HTTPS Redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Blue Target Group (Production)
resource "aws_lb_target_group" "blue" {
  name     = "flowviz-blue-${var.environment}"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  stickiness {
    type    = "lb_cookie"
    enabled = false
  }
}

# Green Target Group (Staging/New Version)
resource "aws_lb_target_group" "green" {
  name     = "flowviz-green-${var.environment}"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

# ACM Certificate (SSL/TLS)
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name  # e.g., flowviz.example.com
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }
}
```

#### Step 4: Auto Scaling Group (`asg.tf`)

```hcl
# Latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# Launch Template
resource "aws_launch_template" "app" {
  name_prefix   = "flowviz-${var.environment}-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = "t3.medium"

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  user_data = base64encode(templatefile("${path.module}/scripts/user-data.sh", {
    environment         = var.environment
    ecr_repository_url  = aws_ecr_repository.app.repository_url
    secrets_arn         = aws_secretsmanager_secret.app.arn
    aws_region          = var.aws_region
    database_endpoint   = aws_db_instance.main.endpoint
    redis_endpoint      = aws_elasticache_cluster.main.cache_nodes[0].address
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "flowviz-app-${var.environment}"
    }
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "app" {
  name                = "flowviz-asg-${var.environment}"
  vpc_zone_identifier = module.vpc.private_subnets
  target_group_arns   = [aws_lb_target_group.blue.arn]

  min_size         = var.environment == "production" ? 2 : 1
  max_size         = var.environment == "production" ? 4 : 2
  desired_capacity = var.environment == "production" ? 2 : 1

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  health_check_type         = "ELB"
  health_check_grace_period = 300  # 5 minutes for container startup

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  tag {
    key                 = "Name"
    value               = "flowviz-app-${var.environment}"
    propagate_at_launch = true
  }
}

# Auto Scaling Policy (CPU-based)
resource "aws_autoscaling_policy" "cpu" {
  name                   = "flowviz-cpu-scaling-${var.environment}"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

#### Step 5: User Data Script (`scripts/user-data.sh`)

```bash
#!/bin/bash
set -e

# Update system
apt-get update
apt-get install -y docker.io awscli jq

# Start Docker
systemctl start docker
systemctl enable docker

# Login to ECR
aws ecr get-login-password --region ${aws_region} | \
  docker login --username AWS --password-stdin ${ecr_repository_url}

# Fetch secrets from AWS Secrets Manager
SECRETS=$(aws secretsmanager get-secret-value \
  --secret-id ${secrets_arn} \
  --region ${aws_region} \
  --query SecretString \
  --output text)

export SECRET_KEY=$(echo $SECRETS | jq -r '.SECRET_KEY')
export DATABASE_URL="postgresql+asyncpg://flowviz_admin:$(echo $SECRETS | jq -r '.DB_PASSWORD')@${database_endpoint}/flowviz"
export REDIS_URL="redis://${redis_endpoint}:6379/0"

# Pull and run FastAPI container
docker pull ${ecr_repository_url}:latest

docker run -d \
  --name flowviz-api \
  --restart unless-stopped \
  -p 8000:8000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e REDIS_URL="$REDIS_URL" \
  -e SECRET_KEY="$SECRET_KEY" \
  -e ENVIRONMENT="${environment}" \
  -e DEBUG="false" \
  ${ecr_repository_url}:latest

# Wait for health check
for i in {1..30}; do
  if curl -f http://localhost:8000/api/health; then
    echo "FastAPI is healthy"
    exit 0
  fi
  sleep 5
done

echo "Health check failed after 150s"
exit 1
```

---

## Validation Gates

### Level 1: Terraform Syntax & Plan

```bash
cd infrastructure/

# Initialize Terraform (first time only)
terraform init

# Format code
terraform fmt -recursive

# Validate configuration
terraform validate

# Plan deployment (review changes)
terraform plan -out=tfplan

# Expected output: ~40 resources to create
# Verify:
# - VPC with 6 subnets (2 public, 2 private, 2 database)
# - RDS instance with Multi-AZ
# - ALB with 2 target groups
# - ASG with min 2 instances
```

### Level 2: Infrastructure Deployment

```bash
# Apply Terraform plan
terraform apply tfplan

# Verify outputs
terraform output

# Expected outputs:
# - alb_dns_name: flowviz-alb-production-xxxx.us-east-1.elb.amazonaws.com
# - rds_endpoint: flowviz-production.xxxx.us-east-1.rds.amazonaws.com:5432
# - redis_endpoint: flowviz-cache-production.xxxx.cache.amazonaws.com:6379

# Check AWS Console:
# - EC2 → Load Balancers: 1 ALB in "active" state
# - EC2 → Target Groups: 2 target groups (blue with 2 healthy, green with 0)
# - RDS → Databases: 1 instance "available"
# - ElastiCache → Redis: 1 cluster "available"
```

### Level 3: Health Check Validation

```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test health endpoint
curl -f https://$ALB_DNS/api/health

# Expected response (HTTP 200):
# {"status":"ok","timestamp":"2026-01-19T12:00:00Z"}

# Test authenticated endpoint (should get 401)
curl -i https://$ALB_DNS/api/lots

# Expected: HTTP 401 Unauthorized
```

### Level 4: Application Smoke Test

```bash
# 1. Login and get JWT token
TOKEN=$(curl -s -X POST https://$ALB_DNS/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@flowviz.test"}' | jq -r '.token')

# 2. Create a test lot
curl -X POST https://$ALB_DNS/api/lots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lot_code": "TEST-001",
    "lot_type": "RAW",
    "weight_kg": 100.5,
    "temperature_c": 4.0
  }'

# Expected: HTTP 201 Created with lot details

# 3. Query traceability
curl https://$ALB_DNS/api/traceability/TEST-001 \
  -H "Authorization: Bearer $TOKEN"

# Expected: HTTP 200 with traceability graph
```

### Level 5: Blue-Green Deployment Test

```bash
# 1. Build and push new Docker image to ECR
cd backend
docker build -t flowviz-api:v1.1.0 -f docker/Dockerfile .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ECR_REPO>
docker tag flowviz-api:v1.1.0 <ECR_REPO>:v1.1.0
docker push <ECR_REPO>:v1.1.0

# 2. Update green target group to use new AMI
cd infrastructure
terraform apply -target=aws_autoscaling_group.app_green  # (if separate green ASG)

# 3. Wait for green instances to be healthy
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw green_target_group_arn)

# Expected: All targets "healthy"

# 4. Switch ALB listener to green target group
terraform apply -var="active_target_group=green"

# 5. Monitor for 15 minutes
watch -n 10 'curl -s https://$ALB_DNS/api/health | jq'

# 6. Rollback if issues detected
terraform apply -var="active_target_group=blue"
```

### Level 6: CloudWatch Monitoring

```bash
# Check application logs
aws logs tail /aws/ecs/flowviz-api --follow

# Check RDS Performance Insights
aws rds describe-db-instances \
  --db-instance-identifier flowviz-production \
  --query 'DBInstances[0].PerformanceInsightsEnabled'

# Expected: true

# Check ALB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=<ALB_ARN> \
  --statistics Average \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300

# Expected: Average response time < 500ms
```

---

## Cost Estimation

### Monthly AWS Costs (Production)

| Service | Specification | Monthly Cost |
|---------|---------------|--------------|
| **EC2 Instances** | 2x t3.medium (24/7) | $60 |
| **RDS PostgreSQL** | db.t3.medium Multi-AZ | $110 |
| **ElastiCache Redis** | cache.t3.micro | $15 |
| **NAT Gateway** | 2x NAT (one per AZ) | $64 |
| **Application Load Balancer** | 1 ALB | $23 |
| **Data Transfer** | ~100 GB/month | $9 |
| **S3 Storage** | Terraform state, backups | $5 |
| **CloudWatch Logs** | 10 GB ingestion | $5 |
| **Secrets Manager** | 5 secrets | $2 |
| **Total** | | **~$293/month** |

**Cost Optimization Tips**:
- Use Reserved Instances for EC2/RDS: Save 30-40%
- Single NAT Gateway in staging: Save $32/month
- Use S3 Glacier for long-term backups: Save on storage

---

## Rollback Strategy

### Scenario 1: Failed Deployment (Green Instances Unhealthy)

**Trigger**: Green target group health checks fail for >5 minutes

**Action**:
1. Keep blue target group active (no traffic shift occurred)
2. Terminate green instances
3. Review CloudWatch Logs for errors
4. Fix issue and retry deployment

### Scenario 2: Performance Degradation After Traffic Shift

**Trigger**: P99 latency >2 seconds or error rate >5%

**Action**:
```bash
# Immediate rollback: Switch listener back to blue
terraform apply -var="active_target_group=blue"

# Wait 2 minutes for connection draining
sleep 120

# Verify blue is serving traffic
curl https://$ALB_DNS/api/health

# Keep green running for post-mortem analysis
```

**Recovery Time Objective (RTO)**: <5 minutes

### Scenario 3: Database Migration Failure

**Trigger**: Alembic migration fails during deployment

**Action**:
1. DO NOT proceed with traffic shift
2. Restore RDS snapshot to previous version
3. Point green instances to restored database
4. Fix migration script and retry

**Prevention**:
- Test migrations on staging environment first
- Use database snapshots before each migration
- Implement migration rollback scripts

---

## Security Checklist

- [ ] All traffic uses HTTPS with TLS 1.3 (ELBSecurityPolicy-TLS13-1-2-2021-06)
- [ ] RDS in private subnet with no public IP
- [ ] Security groups follow least-privilege (only required ports)
- [ ] IAM roles use managed policies (no inline policies with *)
- [ ] Secrets stored in AWS Secrets Manager (no hardcoded credentials)
- [ ] S3 buckets have encryption enabled
- [ ] VPC Flow Logs enabled for network traffic analysis
- [ ] CloudWatch Logs retention set to 7 days (compliance)
- [ ] MFA required for AWS Console access
- [ ] Terraform state encrypted in S3 with KMS
- [ ] SSH key pairs rotated every 90 days
- [ ] No SSH access to EC2 instances (use AWS Systems Manager Session Manager)

---

## Post-Deployment Checklist

- [ ] Update DNS records to point to ALB DNS name
- [ ] Configure CloudWatch alarms for critical metrics (CPU, memory, RDS connections)
- [ ] Set up Grafana dashboards for production monitoring
- [ ] Schedule regular RDS snapshots (in addition to automated backups)
- [ ] Test disaster recovery procedure (restore from backup)
- [ ] Document runbook for common operations (scaling, deployments, rollbacks)
- [ ] Train operations team on blue-green deployment process
- [ ] Set up PagerDuty/OpsGenie for incident alerting
- [ ] Conduct tabletop exercise for incident response
- [ ] Update HACCP compliance documentation with infrastructure details

---

## Anti-Patterns to Avoid

❌ **DON'T** use default VPC (security risk, no isolation)
✅ **DO** create custom VPC with proper subnet segmentation

❌ **DON'T** use `t2` instances (older generation)
✅ **DO** use `t3` or newer for better price/performance

❌ **DON'T** hardcode secrets in Terraform code
✅ **DO** use AWS Secrets Manager with random password generation

❌ **DON'T** commit `terraform.tfstate` or `terraform.tfvars` to Git
✅ **DO** use S3 backend and environment-specific `.tfvars` files

❌ **DON'T** use single AZ for production RDS
✅ **DO** enable Multi-AZ for 99.99% SLA

❌ **DON'T** skip health check grace period
✅ **DO** set 300s grace period for container startup

❌ **DON'T** change RDS master password after creation
✅ **DO** use IAM database authentication for application

---

## References & Additional Resources

### Official AWS Documentation
- [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS VPC Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-best-practices.html)
- [RDS PostgreSQL Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)

### Terraform Modules
- [AWS VPC Module](https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws)
- [AWS RDS Module](https://registry.terraform.io/modules/terraform-aws-modules/rds/aws)
- [AWS ALB Module](https://registry.terraform.io/modules/terraform-aws-modules/alb/aws)
- [AWS ASG Module](https://registry.terraform.io/modules/terraform-aws-modules/autoscaling/aws)

### Blue-Green Deployment Resources
- [Martin Fowler: Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [AWS DevOps Blog: Fine-tuning Blue-Green](https://aws.amazon.com/blogs/devops/blue-green-deployments-with-application-load-balancer/)
- [HashiCorp: Blue-Green Tutorial](https://developer.hashicorp.com/terraform/tutorials/aws/blue-green-canary-tests-deployments)

### Security & Compliance
- [AWS Security Best Practices](https://docs.aws.amazon.com/security/)
- [PostgreSQL Security Hardening](https://www.datavail.com/blog/10-best-practices-to-secure-postgresql-aws-rds-aurora/)
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)

### Cost Optimization
- [AWS Pricing Calculator](https://calculator.aws/)
- [AWS Cost Explorer](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/)
- [Reserved Instances Guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-reserved-instances.html)

---

## Confidence Score: 7/10

### Confidence Breakdown

**High Confidence (9/10)**:
- VPC and networking setup (well-documented patterns)
- RDS PostgreSQL configuration (proven best practices)
- ALB and target group configuration (standard AWS pattern)
- Security group and IAM roles (follows least-privilege)

**Medium Confidence (7/10)**:
- User data script complexity (Docker + AWS CLI + Secrets Manager)
- ElastiCache compatibility with Valkey (minor protocol differences possible)
- PostgreSQL 17 availability (may need fallback to version 16)
- Blue-green deployment automation (requires manual testing)

**Areas Requiring Validation**:
1. **Valkey → ElastiCache Migration**: Test SlowAPI rate limiting and Celery with ElastiCache Redis 7.1
2. **Database Migration**: Test Alembic migrations against RDS PostgreSQL (local dev uses PostgreSQL 17)
3. **Container Startup Time**: Tune health check grace period based on actual startup time
4. **Cost Estimation**: Monitor first month costs and adjust instance types if needed
5. **SSL Certificate**: Ensure domain ownership for ACM certificate validation

**Recommended Mitigation**:
- Deploy to staging environment first (use `environment = "staging"` variable)
- Run full smoke test suite before production traffic shift
- Keep blue environment running for 24 hours after green deployment
- Have rollback runbook printed and accessible during deployment

**Overall Assessment**: This PRP provides a solid foundation for AWS infrastructure deployment. The 7/10 confidence reflects the complexity of cloud migrations and the need for iterative testing. With proper staging validation, confidence will increase to 9/10 for production deployment.

---

**Last Updated:** January 19, 2026
**Next Steps:** INITIAL-8b.md (Load Testing & Pilot Launch)
