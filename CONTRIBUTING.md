# Contributing to Flow-Viz React

Thank you for your interest in contributing! This document outlines our branching model, workflow, and contribution standards.

---

## 📋 Table of Contents

- [Branching Model](#branching-model)
- [Pull Request Workflow](#pull-request-workflow)
- [Commit Conventions](#commit-conventions)
- [Code Standards](#code-standards)
- [Review Process](#review-process)

---

## 🌳 Branching Model

We follow a **phase-based branching model** for structured, auditable delivery.

### Branch Hierarchy

```
main (production)
  │
  └── develop (integration)
        │
        ├── phase/0-before-dev (bootstrap)
        ├── phase/1-architecture
        ├── phase/2-core-features
        └── phase/X-...
```

### Branch Roles

| Branch | Purpose | Protection Level |
|--------|---------|------------------|
| `main` | Production-ready code. Tagged releases only. No direct commits. | **Strict** |
| `develop` | Integration branch. All phase branches merge here first. | **Moderate** |
| `phase/X-*` | Logical delivery phases. Never deleted after merge. | **Light** |

### Protection Rules

#### `main` (Strict)
- ✅ Require Pull Request before merging
- ✅ Require status checks (CI: lint, test, build)
- ✅ Require at least 1 approval
- ✅ Dismiss stale approvals on new commits
- ✅ Require linear history
- ✅ Restrict who can push (admins only)
- ❌ No force-push
- ❌ No branch deletion

#### `develop` (Moderate)
- ✅ Require Pull Request
- ✅ Require CI status checks
- ⚪ Optional: 1 approval

#### `phase/*` (Light)
- ✅ Require Pull Request + CI
- ❌ Never delete (preserved for audit trail)

---

## 🔄 Pull Request Workflow

### Creating a Phase Branch

```bash
# Always branch from develop
git checkout develop
git pull origin develop
git checkout -b phase/X-feature-name
```

### Development Flow

```
1. Create phase branch from develop
2. Develop and commit with conventional commits
3. Push and create PR → develop
4. Pass CI checks + code review
5. Merge to develop (merge commit)
6. When ready for release: PR develop → main
7. Tag release on main
```

### PR Requirements

- [ ] All CI checks pass (lint, test, build)
- [ ] PR description explains the changes
- [ ] Linked to relevant issues (if applicable)
- [ ] Code follows project standards
- [ ] At least 1 approving review

---

## 📝 Commit Conventions

We use **Conventional Commits** for clean history and automated changelogs.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Code style (formatting, semicolons, etc.) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Build process, dependencies, tooling |
| `ci` | CI configuration changes |

### Examples

```bash
feat(auth): add role-based access control for routes
fix(lots): correct weight calculation in genealogy
docs(readme): add quickstart guide
chore(deps): upgrade react to v19
refactor(stores): simplify production state management
```

### Breaking Changes

Use `!` after type or add `BREAKING CHANGE:` in footer:

```bash
feat(api)!: change response format for lot endpoints

BREAKING CHANGE: lot API now returns nested genealogy object
```

---

## 🎨 Code Standards

### TypeScript/React

- Use TypeScript strict mode
- Prefer functional components with hooks
- Use Zustand for state management
- Follow ESLint configuration
- Use Prettier for formatting

### File Organization

```
src/
├── components/        # Reusable UI components
│   └── ComponentName/
│       ├── index.tsx
│       └── ComponentName.test.tsx
├── pages/             # Route-level components
├── stores/            # Zustand stores
├── types/             # TypeScript type definitions
├── lib/               # Utilities and helpers
└── styles/            # Global styles
```

### Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `FlowCanvas.tsx` |
| Hooks | camelCase, `use` prefix | `useProductionStore.ts` |
| Types/Interfaces | PascalCase | `ScenarioConfig` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_LOT_WEIGHT` |
| Files | kebab-case or PascalCase | `flow-canvas.tsx` or `FlowCanvas.tsx` |

---

## 👀 Review Process

### Merge Strategies

| PR Type | Strategy | Reason |
|---------|----------|--------|
| Feature PRs into phase | **Squash merge** | Clean, atomic history |
| Phase PRs into develop | **Merge commit** | Preserves phase boundaries |
| Develop into main | **Merge commit** | Traceable release points |

### Review Checklist

For reviewers:

- [ ] Code is readable and well-structured
- [ ] No obvious bugs or logic errors
- [ ] Types are properly defined
- [ ] No security vulnerabilities
- [ ] Tests cover new functionality
- [ ] Documentation updated if needed

---

## 🏷️ Releases

Releases are tagged on `main` after merging from `develop`:

```bash
# After merging develop → main
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Release v1.0.0: Initial production release"
git push origin v1.0.0
```

### Version Format

We follow [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH

1.0.0 — Initial release
1.1.0 — New features, backward compatible
1.1.1 — Bug fixes
2.0.0 — Breaking changes
```

---

## ❓ Questions?

Open an issue or reach out to the maintainers listed in [CODEOWNERS](.github/CODEOWNERS).
