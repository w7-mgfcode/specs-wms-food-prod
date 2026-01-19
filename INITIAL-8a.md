# Production Deployment: Cloud Infrastructure Provisioning

> **Phase:** 4.3a - Cloud Infrastructure  
> **Sprint:** Week 8  
> **Priority:** HIGH (Production gate)  
> **Date:** January 19, 2026  
> **Version:** 1.0  
> **Prerequisites:** INITIAL-6.md (Security), INITIAL-7a/b.md (Infrastructure)

---

## FEATURE:

Deploy the Food Production WMS to cloud infrastructure with proper network isolation, load balancing, and high availability:

1. **AWS Infrastructure:** VPC, RDS PostgreSQL, ElastiCache, ALB with SSL termination, EC2 Auto Scaling

2. **On-Premise Alternative:** Nginx reverse proxy, Docker Compose, VLAN isolation

3. **Blue-Green Deployment:** Zero-downtime deployments with ALB target group switching

**Success Criteria:**
- Infrastructure provisioned via Terraform (reproducible)
- Multi-AZ deployment for high availability
- SSL/TLS 1.3 enabled for all traffic
- Blue-green target groups configured

---

## TOOLS:

- **Terraform / CloudFormation**: Infrastructure-as-Code for AWS. Manages VPC, EC2, RDS, ElastiCache, ALB.

- **AWS ALB (Application Load Balancer)**: Layer 7 load balancer with health checks, blue-green deployment via target group switching.

- **pg_isready**: PostgreSQL connection health check for ALB target health.

- **docker compose --profile production**: Profile selector for production-specific services.

---

## DEPENDENCIES:

### AWS Services (Recommended)
```
├── EC2 (t3.medium x2): FastAPI + Celery workers
├── RDS PostgreSQL (db.t3.medium): Managed database
├── ElastiCache Redis (cache.t3.micro): Valkey replacement
├── ALB: Load balancer with SSL termination
├── S3: Backup storage + static assets
├── Secrets Manager: Secure credential storage
├── CloudWatch: Logs and metrics
└── Route 53: DNS management (optional)

Estimated Cost: ~$210/month
```

### On-Premise Alternative
```
├── 2x Ubuntu 22.04 VMs (16GB RAM, 4 vCPU each)
├── 1x PostgreSQL server (32GB RAM, 8 vCPU, 2TB SSD)
├── Network: Gigabit Ethernet, VLAN isolation
├── Docker + Docker Compose
├── Nginx (reverse proxy + SSL)
└── Let's Encrypt (TLS certificates)
```

---

## SYSTEM PROMPT(S):

### Deployment Engineer Prompt
```
You are deploying a Food Production WMS to production. Follow these principles:

**Infrastructure as Code:**
- All resources defined in Terraform/CloudFormation
- No manual console changes (drift detection enabled)
- Separate state files for staging vs production

**Security Posture:**
- All traffic over HTTPS (TLS 1.3 minimum)
- Database in private subnet (no public IP)
- Security groups: least privilege (only required ports)
- Secrets never in code, logs, or environment variables

**High Availability:**
- Multi-AZ deployment for RDS
- ALB across 2+ availability zones
- Auto-scaling group with min 2 instances
- Connection draining for graceful shutdown

**Deployment Strategy:**
- Blue-green deployment for zero-downtime
- Health checks must pass before traffic shift
- Keep old version running for 15 minutes (quick rollback)
- Database migrations run separately before deployment
```

### Go-Live Checklist Prompt
```
Before shifting production traffic, verify ALL items:

PRE-DEPLOYMENT:
[ ] Secrets Manager configured with production credentials
[ ] Database migrated to latest schema
[ ] SSL certificate valid for 90+ days
[ ] Backup job running successfully for 3+ days
[ ] Grafana dashboards accessible

DEPLOYMENT:
[ ] Health check endpoint returning 200
[ ] All services running (docker ps shows healthy)
[ ] Database connections successful
[ ] Redis/Valkey connectivity verified

POST-DEPLOYMENT:
[ ] Smoke test: Create lot, QC decision, traceability query
[ ] Performance: P99 <500ms on health endpoint
[ ] Monitor for 15 minutes before full traffic shift

ROLLBACK TRIGGER:
- Error rate >5% for 2 minutes
- P99 latency >2 seconds
- Database connection errors
```

---

## IMPLEMENTATION:

### AWS VPC and Network Configuration

```hcl
# infrastructure/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "flowviz-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
    encrypt = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "FlowViz"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"

  name = "flowviz-${var.environment}"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"
  
  enable_dns_hostnames = true
  enable_dns_support   = true

  create_database_subnet_group = true
}
```

### Application Load Balancer

```hcl
# infrastructure/alb.tf
resource "aws_lb" "main" {
  name               = "flowviz-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "production"
}

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

# Blue-Green Target Groups
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
    path                = "/health"
    timeout             = 5
    unhealthy_threshold = 3
  }
  deregistration_delay = 30
}

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
    path                = "/health"
    timeout             = 5
    unhealthy_threshold = 3
  }
}
```

### RDS PostgreSQL + ElastiCache

```hcl
# infrastructure/rds.tf
resource "aws_db_instance" "main" {
  identifier = "flowviz-${var.environment}"
  
  engine         = "postgres"
  engine_version = "17.2"
  instance_class = var.environment == "production" ? "db.t3.medium" : "db.t3.micro"
  
  allocated_storage     = 100
  max_allocated_storage = 500
  storage_type          = "gp3"
  storage_encrypted     = true
  
  db_name  = "flowviz"
  username = "flowviz_admin"
  password = aws_secretsmanager_secret_version.db_password.secret_string
  
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  
  multi_az               = var.environment == "production"
  publicly_accessible    = false
  
  backup_retention_period = 7
  deletion_protection = var.environment == "production"
  performance_insights_enabled = true
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "flowviz-cache-${var.environment}"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  port                 = 6379
  
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.cache.id]
}
```

### EC2 Auto Scaling Group

```hcl
# infrastructure/asg.tf
resource "aws_launch_template" "app" {
  name_prefix   = "flowviz-${var.environment}-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = "t3.medium"
  
  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }
  
  vpc_security_group_ids = [aws_security_group.app.id]
  
  user_data = base64encode(templatefile("${path.module}/scripts/user-data.sh", {
    environment        = var.environment
    ecr_repository_url = aws_ecr_repository.app.repository_url
    secrets_arn        = aws_secretsmanager_secret.app.arn
  }))
}

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
  health_check_grace_period = 300
  
  instance_refresh {
    strategy = "Rolling"
    preferences { min_healthy_percentage = 50 }
  }
}
```

### On-Premise Nginx Configuration

```nginx
# /etc/nginx/sites-available/flowviz
upstream flowviz_api {
    least_conn;
    server 10.0.1.10:8000 weight=1 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8000 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name flowviz.factory.local;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name flowviz.factory.local;
    
    ssl_certificate /etc/letsencrypt/live/flowviz.factory.local/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowviz.factory.local/privkey.pem;
    ssl_protocols TLSv1.3;
    
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://flowviz_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## EXAMPLES:

- `backend/docker/docker-compose.yml` - Current service definitions
- Terraform AWS VPC Module: https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws

---

## DOCUMENTATION:

- AWS Best Practices: https://docs.aws.amazon.com/wellarchitected/
- Terraform AWS Provider: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- Blue-Green Deployment: https://martinfowler.com/bliki/BlueGreenDeployment.html

---

## OTHER CONSIDERATIONS:

### Action Items (Week 8)

- [ ] Day 1: Cloud provider decision finalized (AWS vs on-prem)
- [ ] Day 2-3: Terraform code for VPC, RDS, ElastiCache
- [ ] Day 4-5: ALB configuration with SSL certificates

### Critical Decisions

| Decision | Options | Deadline | Impact |
|----------|---------|----------|--------|
| Cloud Provider | AWS, Azure, On-Premise | Week 8 Day 1 | Entire infrastructure |

### Deliverables

- [ ] `infrastructure/main.tf` - VPC and provider config
- [ ] `infrastructure/alb.tf` - Load balancer with blue-green
- [ ] `infrastructure/rds.tf` - Database and cache
- [ ] `infrastructure/asg.tf` - Auto scaling group

**Effort Estimate:** 5 days (1 DevOps engineer)

---

**Phase:** 4.3a - Cloud Infrastructure  
**Last Updated:** January 19, 2026  
**Next Part:** INITIAL-8b.md (Load Testing & Pilot Launch)
