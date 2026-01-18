#!/bin/bash
# ==============================================================================
# Branch Setup Script for Phase-Based Workflow
# ==============================================================================
# This script initializes the branch structure following the engineering guideline.
# Run this once after repository creation to set up main, develop, and phase/0.
#
# Usage:
#   chmod +x scripts/setup-branches.sh
#   ./scripts/setup-branches.sh
# ==============================================================================

set -e

echo "🔧 Setting up phase-based branch structure..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not a git repository. Run 'git init' first.${NC}"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH}${NC}"

# Ensure we have at least one commit
if ! git rev-parse HEAD >/dev/null 2>&1; then
    echo -e "${YELLOW}No commits found. Creating initial commit...${NC}"
    git add .
    git commit -m "chore: initial repository setup (phase-0)"
fi

# Create develop branch if it doesn't exist
if git show-ref --verify --quiet refs/heads/develop; then
    echo -e "${GREEN}✓ develop branch already exists${NC}"
else
    echo "Creating develop branch..."
    git checkout -b develop
    git checkout "$CURRENT_BRANCH"
    echo -e "${GREEN}✓ Created develop branch${NC}"
fi

# Create phase/0-before-dev branch if it doesn't exist
if git show-ref --verify --quiet refs/heads/phase/0-before-dev; then
    echo -e "${GREEN}✓ phase/0-before-dev branch already exists${NC}"
else
    echo "Creating phase/0-before-dev branch from develop..."
    git checkout develop
    git checkout -b phase/0-before-dev
    git checkout "$CURRENT_BRANCH"
    echo -e "${GREEN}✓ Created phase/0-before-dev branch${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}Branch structure setup complete!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Current branches:"
git branch -a
echo ""
echo "Next steps:"
echo "  1. Push branches to remote: git push -u origin main develop phase/0-before-dev"
echo "  2. Configure branch protection rules in GitHub settings"
echo "  3. Start development on phase/0-before-dev"
echo ""
echo "Workflow:"
echo "  phase/0-before-dev → PR → develop → PR → main (release)"
echo ""
