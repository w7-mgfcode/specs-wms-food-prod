# GitHub Actions Fix - Action Plan

## Immediate Actions (Next 5 Minutes)

### 1. Review Changes
```bash
# Review all modified workflow files
git diff .github/workflows/

# Verify no syntax errors
yamllint .github/workflows/*.yml  # Optional if you have yamllint
```

### 2. Commit Changes
```bash
# Stage all workflow changes
git add .github/workflows/

# Commit with detailed message
git commit -F COMMIT_MESSAGE.txt

# Or use conventional commit:
git commit -m "fix(ci): correct monorepo paths in all GitHub Actions workflows

All 6 CI/CD checks were failing due to incorrect path references.
Updated all workflows to match actual repository structure:
- flow-viz-react/ (frontend)
- backend/ (Python backend)

Changes:
- Update cache-dependency-path to correct locations
- Use defaults.run.working-directory for consistency
- Consolidate duplicate backend jobs (2 → 1)
- Downgrade GitHub Actions to stable @v4 versions

Fixes: #13"
```

### 3. Push to Remote
```bash
# Push to develop branch
git push origin develop

# Monitor workflow runs
gh run watch
# Or visit: https://github.com/w7-mgfcode/specs-wms-food-prod/actions
```

---

## Monitoring (Next 10 Minutes)

### Expected Workflow Behavior

#### ✅ **Success Indicators**
1. **Frontend ESLint** (~30-45s)
   - ✅ Checkout succeeds
   - ✅ Node.js setup with cache succeeds
   - ✅ `npm ci` completes
   - ✅ `npm run lint` passes

2. **Backend Flake8** (~20-30s)
   - ✅ Checkout succeeds
   - ✅ Python setup succeeds
   - ✅ `flake8 app` runs without errors

3. **Python Unit Tests** (~40-60s)
   - ✅ Checkout succeeds
   - ✅ `pip install -e ".[dev]"` completes
   - ✅ `pytest tests/` runs (may have test failures, but install works)

4. **Security Analysis** (~45-60s)
   - ✅ Bandit scan completes
   - ✅ ESLint security scan completes

5. **Playwright E2E** (~60-90s)
   - ✅ Checkout succeeds
   - ✅ Dependencies install
   - ✅ Playwright browsers install
   - ✅ Tests run (may fail on actual tests, but setup works)

6. **Docker Builds** (~3-5 minutes)
   - ✅ Backend container builds
   - ✅ Frontend container builds

#### ❌ **Failure Scenarios & Fixes**

| Failure | Cause | Fix |
|---------|-------|-----|
| "No such file or directory" | Path still wrong | Double-check working-directory |
| "unable to cache dependencies" | Wrong cache-dependency-path | Verify package-lock.json path |
| "pip install -e .[dev] failed" | Missing pyproject.toml | Check backend/pyproject.toml exists |
| "flake8: command not found" | Missing pip install | Add flake8 to install step |
| "npm ci failed" | Corrupted package-lock.json | Run `npm install` locally and commit |

---

## Verification Checklist

### Pre-Push Verification
- [x] All workflow files modified
- [x] Paths updated to match repository structure
- [x] Action versions downgraded to @v4
- [x] defaults.run.working-directory added
- [x] Duplicate jobs consolidated
- [x] No YAML syntax errors

### Post-Push Verification
- [ ] All 6 workflows triggered
- [ ] Frontend ESLint passes
- [ ] Backend Flake8 passes
- [ ] Python Unit Tests passes (or fails on actual tests, not setup)
- [ ] Security Analysis passes
- [ ] Playwright E2E passes (or fails on actual tests, not setup)
- [ ] Docker Builds passes

### Merge Readiness
- [ ] All required checks pass
- [ ] PR #13 shows green checkmarks
- [ ] No merge conflicts
- [ ] 1 approving review obtained (if required)

---

## Rollback Plan (If Needed)

If workflows still fail after push:

```bash
# Revert the commit
git revert HEAD

# Push revert
git push origin develop

# Re-analyze the issue
gh run view <failed-run-id> --log-failed
```

---

## Phase 2 Improvements (After Merge)

### 1. Add Dependency Caching
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('backend/pyproject.toml') }}
```

### 2. Add Concurrency Groups
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 3. Add Path Validation
```yaml
- name: Validate paths
  run: |
    test -f flow-viz-react/package-lock.json || exit 1
    test -f backend/pyproject.toml || exit 1
```

### 4. Add Workflow Status Badges
```markdown
[![Frontend ESLint](https://github.com/w7-mgfcode/specs-wms-food-prod/actions/workflows/frontend-eslint.yml/badge.svg)](https://github.com/w7-mgfcode/specs-wms-food-prod/actions/workflows/frontend-eslint.yml)
```

### 5. Set Up Branch Protection
- Require all checks to pass before merge
- Require 1 approving review
- Require linear history
- Require signed commits (optional)

---

## Success Criteria

✅ **Immediate Success:**
- All 6 workflows pass on next push
- PR #13 can be merged

✅ **Long-term Success:**
- Workflows remain stable across future PRs
- CI/CD pipeline provides fast feedback (<5 minutes total)
- No false positives or path-related failures

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| **Fix Implementation** | 30 minutes | ✅ Complete |
| **Commit & Push** | 5 minutes | ⏳ Pending |
| **CI Verification** | 10 minutes | ⏳ Pending |
| **PR Merge** | 5 minutes | ⏳ Pending |
| **Phase 2 Improvements** | 1-2 hours | 📋 Planned |

**Total Time to Unblock:** ~20 minutes from now

---

## Contact & Support

If issues persist:
1. Check workflow logs: `gh run view <run-id> --log-failed`
2. Review this document: `ACTION_PLAN.md`
3. Check detailed report: `CI_FIX_REPORT.md`
4. Review summary: `WORKFLOW_FIX_SUMMARY.md`

---

**Ready to proceed!** 🚀

