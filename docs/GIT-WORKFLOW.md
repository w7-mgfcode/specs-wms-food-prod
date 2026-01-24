# Git Workflow & Branch Structure

**Repository**: specs-wms-food-prod  
**Strategy**: Phase-Based Development with Gitflow  
**Last Updated**: 2026-01-19

---

## 📊 Branch Hierarchy

```plaintext
main (production) 🔒 [v0.5.0]
  │
  └── develop (integration) 🔒
        │
        ├── phase/0-before-dev 🔒 (bootstrap - preserved)
        ├── phase/1-backend-migration ✅ (v0.1.0 - v0.2.0)
        ├── phase/2-backend-migration ✅ (characterization tests)
        ├── phase/3-first-flow ✅ (v0.3.0 - Flow V4 UI)
        ├── phase/4-frontend-fastapi-integration ✅ (v0.4.0)
        ├── phase/5-development ✅ (v0.5.0 - Security Hardening)
        ├── phase/6-infrastructure (planned)
        ├── phase/7-ui-enhancements (planned)
        ├── phase/8a-database-optimization (planned)
        ├── phase/7b-monitoring (planned)
        ├── phase/8a-cloud-infrastructure (planned)
        ├── phase/8b-load-testing (planned)
        ├── phase/9a-advanced-traceability (planned)
        └── phase/9b-production-optimization (planned)
```

---

## 🔒 Branch Protection Rules

### Main Branch (`main`)

**Protection Level**: 🔴 **Strict**

- ✅ Require pull request before merging
- ✅ Require 1 approval before merging
- ✅ Require status checks to pass (CI/CD)
- ✅ Require branches to be up to date before merging
- ❌ No force pushes allowed
- ❌ No deletions allowed
- ✅ Require linear history (merge commits only)
- ✅ Include administrators in restrictions

**Purpose**: Production-ready code only. All releases tagged here.

### Develop Branch (`develop`)

**Protection Level**: 🟡 **Moderate**

- ✅ Require pull request before merging
- ✅ Require status checks to pass (CI/CD)
- ⚠️ Approvals recommended but not required
- ❌ No force pushes allowed
- ❌ No deletions allowed
- ✅ Allow merge commits and squash merging

**Purpose**: Integration branch for completed phases. Staging environment deploys from here.

### Phase Branches (`phase/*`)

**Protection Level**: 🟢 **Light**

- ⚠️ No pull request required (direct commits allowed)
- ⚠️ No approval required
- ❌ **No deletions allowed** (audit trail preserved)
- ✅ Force pushes allowed (for rebasing during development)
- ✅ Allow all merge strategies

**Purpose**: Feature development branches. Preserved for historical audit trail.

---

## 🌳 Current Branch Status

| Branch | Status | Version | Commits | Merged To | Notes |
|--------|--------|---------|---------|-----------|-------|
| `main` | 🔴 Production | v0.5.0 | e1cf412 | — | Latest release |
| `develop` | 🟡 Integration | — | 16383d7 | — | Ahead of main by 1 commit |
| `phase/0-before-dev` | ✅ Complete | — | e03ebdc | develop | Bootstrap (preserved) |
| `phase/1-backend-migration` | ✅ Complete | v0.1.0-v0.2.0 | 41dc50c | develop | FastAPI foundation |
| `phase/2-backend-migration` | ✅ Complete | — | 0de73c9 | develop | Characterization tests |
| `phase/3-first-flow` | ✅ Complete | v0.3.0 | 0764152 | develop | Flow V4 UI |
| `phase/4-frontend-fastapi-integration` | ✅ Complete | v0.4.0 | 33f805f | develop | Frontend-API integration |
| `phase/5-development` | ✅ Complete | v0.5.0 | eb86e22 | main | Security hardening (RBAC + rate limiting) |

---

## 📋 Workflow Process

### 1. Starting a New Phase

```bash
# Ensure develop is up to date
git checkout develop
git pull origin develop

# Create new phase branch
git checkout -b phase/X-feature-name

# Push to remote
git push -u origin phase/X-feature-name
```

### 2. Development Workflow

```bash
# Make changes
git add .
git commit -m "feat(scope): description"

# Push regularly
git push origin phase/X-feature-name
```

### 3. Merging to Develop

```bash
# Create PR: phase/X → develop
gh pr create --base develop --head phase/X-feature-name \
  --title "Phase X: Feature Name" \
  --body "## Summary\n..."

# After approval and CI passes
gh pr merge --merge
```

### 4. Release to Main

```bash
# Create PR: develop → main
gh pr create --base main --head develop \
  --title "Release vX.Y.Z: Phase X Complete" \
  --body "## Release Summary\n..."

# After approval and CI passes
gh pr merge --merge

# Tag the release
git checkout main
git pull origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z: Phase X Complete"
git push origin vX.Y.Z

# Create GitHub release
gh release create vX.Y.Z --title "vX.Y.Z - Phase X: Feature Name" \
  --notes "Release notes..."
```

---

## 🏷️ Tagging Strategy

### Version Format

**Semantic Versioning**: `vMAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., v1.0.0, v2.0.0)
- **MINOR**: New features, backward compatible (e.g., v0.5.0, v0.6.0)
- **PATCH**: Bug fixes, backward compatible (e.g., v0.5.1, v0.5.2)

### Current Tags

| Tag | Branch | Date | Description |
|-----|--------|------|-------------|
| `v0.5.0` | main | 2026-01-19 | Phase 5: Security Hardening (RBAC + Rate Limiting) |
| `v0.4.0` | main | 2026-01-XX | Phase 4: Frontend-FastAPI Integration |
| `v0.3.0` | main | 2026-01-XX | Phase 3: First Flow (V4 UI) |
| `v0.2.0` | main | 2026-01-XX | Phase 1: Backend Migration (Complete) |
| `v0.1.0` | main | 2026-01-XX | Phase 1: Backend Migration (Initial) |

---

## 📝 Commit Message Convention

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(lots): add genealogy tracking` |
| `fix` | Bug fix | `fix(auth): resolve token expiration issue` |
| `docs` | Documentation only | `docs(phase5): add test results` |
| `refactor` | Code change (no feature/fix) | `refactor(api): extract RBAC dependencies` |
| `test` | Adding/updating tests | `test(rbac): add VIEWER role tests` |
| `chore` | Maintenance tasks | `chore(deps): update slowapi to 0.1.9` |
| `ci` | CI/CD changes | `ci(github): add security analysis workflow` |
| `perf` | Performance improvement | `perf(db): add index on lot_code` |
| `style` | Code style (formatting) | `style(backend): apply ruff fixes` |

### Examples

```bash
# Feature
git commit -m "feat(rbac): implement 5-tier role permissions

- Add require_roles() factory for dependency injection
- Create type aliases (CanCreateLots, CanMakeQCDecisions)
- Apply RBAC to all API endpoints
- Add 30 comprehensive RBAC tests

Closes #42"

# Bug fix
git commit -m "fix(rate-limit): correct Valkey connection string

- Update REDIS_URL format for Valkey compatibility
- Add connection retry logic
- Update tests to use correct connection string"

# Documentation
git commit -m "docs(phase5): add staging deployment guide

- Infrastructure requirements
- Step-by-step deployment instructions
- Smoke tests and rollback procedures"
```

---

## 🔄 Merge Strategies

### Main ← Develop (Releases)

**Strategy**: Merge Commit (preserve history)

```bash
gh pr merge --merge
```

**Rationale**: Preserve complete phase history for audit trail.

### Develop ← Phase/* (Phase Completion)

**Strategy**: Merge Commit (preserve history)

```bash
gh pr merge --merge
```

**Rationale**: Maintain clear phase boundaries and commit history.

### Hotfixes (Emergency)

**Strategy**: Cherry-pick or direct PR to main

```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-security-fix

# Make fix
git commit -m "fix(security): patch critical vulnerability"

# PR directly to main
gh pr create --base main --head hotfix/critical-security-fix

# After merge, sync to develop
git checkout develop
git merge main
```

---

## 📊 Branch Lifecycle

### Phase Branch Lifecycle

```plaintext
1. CREATE    → git checkout -b phase/X-feature
2. DEVELOP   → Multiple commits, pushes
3. PR        → Create PR to develop
4. REVIEW    → Code review, CI checks
5. MERGE     → Merge to develop
6. PRESERVE  → Branch kept for audit (never deleted)
```

### Release Lifecycle

```plaintext
1. INTEGRATE → Merge phase/* to develop
2. TEST      → Run full test suite on develop
3. PR        → Create PR develop → main
4. REVIEW    → Final review, CI checks
5. MERGE     → Merge to main
6. TAG       → Create version tag (vX.Y.Z)
7. RELEASE   → Create GitHub release
8. DEPLOY    → Deploy to production
```

---

## 🎯 Best Practices

### DO ✅

- ✅ Create phase branches from `develop`
- ✅ Use conventional commit messages
- ✅ Keep commits atomic and focused
- ✅ Write descriptive PR descriptions
- ✅ Run tests before pushing
- ✅ Preserve phase branches (audit trail)
- ✅ Tag all releases on `main`
- ✅ Update documentation with code changes

### DON'T ❌

- ❌ Force push to `main` or `develop`
- ❌ Delete phase branches
- ❌ Commit directly to `main` or `develop`
- ❌ Merge without CI passing
- ❌ Use vague commit messages ("fix stuff", "wip")
- ❌ Mix multiple features in one commit
- ❌ Skip code review process

---

## 🔗 Related Documentation

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [CLAUDE.md](../CLAUDE.md) - AI coding guidance
- [docs/architecture.md](architecture.md) - System architecture
- [docs/decisions/](decisions/) - Architecture Decision Records

---

_Last Updated: 2026-01-19 | Current Version: v0.5.0_

