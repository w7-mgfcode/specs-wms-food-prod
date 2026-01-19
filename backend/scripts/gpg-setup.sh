#!/bin/bash
# backend/scripts/gpg-setup.sh
# Generate GPG key pair for backup encryption
# Run this ONCE during initial setup

set -euo pipefail

GPG_NAME="FlowViz Backup Key"
GPG_EMAIL="${GPG_EMAIL:-backup@flowviz.com}"
GPG_PASSPHRASE="${GPG_PASSPHRASE:-}"
OUTPUT_DIR="${OUTPUT_DIR:-./keys}"

echo "=== FlowViz GPG Key Generation ==="
echo "Email: $GPG_EMAIL"
echo "Output: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if key already exists
if gpg --list-keys "$GPG_EMAIL" >/dev/null 2>&1; then
    echo "WARNING: Key for $GPG_EMAIL already exists!"
    read -p "Generate new key anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Generate key using batch mode
cat > /tmp/gpg-key-params <<EOF
%echo Generating FlowViz backup key...
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $GPG_NAME
Name-Email: $GPG_EMAIL
Expire-Date: 0
%no-protection
%commit
%echo Key generation complete
EOF

gpg --batch --generate-key /tmp/gpg-key-params
rm /tmp/gpg-key-params

# Export public key (safe to store in repo)
gpg --export --armor "$GPG_EMAIL" > "$OUTPUT_DIR/backup-public.key"
echo "✓ Public key exported: $OUTPUT_DIR/backup-public.key"

# Export private key (MUST be stored securely!)
gpg --export-secret-keys --armor "$GPG_EMAIL" > "$OUTPUT_DIR/backup-private.key"
chmod 600 "$OUTPUT_DIR/backup-private.key"
echo "✓ Private key exported: $OUTPUT_DIR/backup-private.key"

echo ""
echo "=== IMPORTANT SECURITY NOTES ==="
echo "1. Store backup-private.key in AWS Secrets Manager or HashiCorp Vault"
echo "2. NEVER commit backup-private.key to version control"
echo "3. Add 'keys/*.key' to .gitignore"
echo "4. Test encryption/decryption before relying on these keys"
echo ""
echo "Test encryption:"
echo "  echo 'test' | gpg --encrypt --recipient $GPG_EMAIL | gpg --decrypt"
