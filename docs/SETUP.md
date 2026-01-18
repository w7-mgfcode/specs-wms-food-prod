# Repository Setup Guide

This guide walks through the initial setup of the repository following the **Phase-Based Branching Model**.

---

## 1. Branch Structure Setup

### Quick Setup (Automated)

```bash
chmod +x scripts/setup-branches.sh
./scripts/setup-branches.sh
```

### Manual Setup

```bash
# Ensure you're on main with initial commit
git checkout main

# Create develop branch
git checkout -b develop
git checkout main

# Create phase/0 from develop
git checkout develop
git checkout -b phase/0-before-dev
```

### Push to Remote

```bash
git push -u origin main
git push -u origin develop
git push -u origin phase/0-before-dev
```

---

## 2. Branch Protection Rules (GitHub)

Navigate to **Settings → Branches → Add branch protection rule**

### `main` Branch (Strict)

| Setting | Value |
|---------|-------|
| Branch name pattern | `main` |
| Require a pull request before merging | ✅ |
| Required approving reviews | 1 (or 2 for teams) |
| Dismiss stale pull request approvals | ✅ |
| Require status checks to pass | ✅ |
| Required status checks | `All Tests Passed` |
| Require branches to be up to date | ✅ |
| Require linear history | ✅ (recommended) |
| Restrict who can push | ✅ (admins only) |
| Allow force pushes | ❌ |
| Allow deletions | ❌ |

### `develop` Branch (Moderate)

| Setting | Value |
|---------|-------|
| Branch name pattern | `develop` |
| Require a pull request before merging | ✅ |
| Required approving reviews | 0 or 1 |
| Require status checks to pass | ✅ |
| Required status checks | `All Tests Passed` |

### `phase/*` Branches (Light)

| Setting | Value |
|---------|-------|
| Branch name pattern | `phase/**` |
| Require a pull request before merging | ✅ |
| Require status checks to pass | ✅ |
| Allow deletions | ❌ (preserve for audit) |

---

## 3. GitHub Settings

### Enable Features

- **Settings → General → Features**
  - ✅ Issues
  - ✅ Projects
  - ✅ Discussions (optional)
  - ✅ Wiki (optional)

### Default Branch

- **Settings → General → Default branch**: `main`

### Merge Button Settings

- **Settings → General → Pull Requests**
  - ✅ Allow squash merging (for feature PRs)
  - ✅ Allow merge commits (for phase PRs)
  - ❌ Allow rebase merging (optional)
  - Default: Squash merge

---

## 4. Required Secrets (CI/CD)

Navigate to **Settings → Secrets and variables → Actions**

| Secret | Description | Required For |
|--------|-------------|--------------|
| `DIGITALOCEAN_HOST` | DO droplet IP | Deployment |
| `DIGITALOCEAN_SSH_KEY` | SSH private key | Deployment |
| `DIGITALOCEAN_USERNAME` | SSH username | Deployment |
| `DEPLOYMENT_PATH` | App path on server | Deployment |

---

## 5. Labels Setup

Create these labels for consistent PR/Issue management:

| Label | Color | Description |
|-------|-------|-------------|
| `phase-0` | `#0E8A16` | Bootstrap/setup work |
| `phase-1` | `#1D76DB` | Architecture work |
| `phase-2` | `#5319E7` | Core features |
| `bug` | `#D73A4A` | Something isn't working |
| `feature` | `#A2EEEF` | New feature request |
| `breaking` | `#B60205` | Breaking change |
| `docs` | `#0075CA` | Documentation |
| `ci` | `#FBCA04` | CI/CD related |

---

## 6. First Phase Workflow

```bash
# Start work on phase/0
git checkout phase/0-before-dev

# Make changes, commit with conventional commits
git add .
git commit -m "chore: add project configuration files"

# Push and create PR
git push -u origin phase/0-before-dev

# Create PR: phase/0-before-dev → develop
# After approval and CI pass, merge

# For release: create PR develop → main
# Tag the release
git checkout main
git pull
git tag -a v0.1.0 -m "Phase 0: Repository Bootstrap"
git push origin v0.1.0
```

---

## Checklist

- [ ] Branch structure created (main, develop, phase/0)
- [ ] Branch protection rules configured
- [ ] CI workflow triggers on develop branch
- [ ] CODEOWNERS configured
- [ ] Required secrets added
- [ ] Labels created
- [ ] Initial phase-0 PR merged to develop
