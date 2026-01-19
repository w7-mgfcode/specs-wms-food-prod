#!/bin/bash
# backend/scripts/backup-weekly.sh
# Weekly backup for HACCP 7-year retention
# Runs on Sundays, stored in separate S3 prefix with Glacier transition

set -euo pipefail

# Source the main backup script with weekly type
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Override for weekly retention (kept longer locally for verification)
export RETENTION_DAYS=30

# Run backup with weekly type (goes to weekly/ prefix in S3)
exec "$SCRIPT_DIR/backup.sh" weekly
