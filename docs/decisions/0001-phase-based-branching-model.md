# ADR 0001: Phase-Based Branching Model

**Status:** Accepted  
**Date:** 2026-01-18  
**Decision Makers:** Engineering Team

---

## Context

We need a branching strategy that:
- Keeps `main` always stable and production-ready
- Supports structured, phased delivery
- Maintains full auditability and traceability
- Enforces quality gates via CI and code review
- Scales for team collaboration

Traditional Git Flow and GitHub Flow both have trade-offs:
- **Git Flow:** Complex with release branches, may be overkill
- **GitHub Flow:** Too simple for phased delivery, lacks structure

---

## Decision

We adopt a **Phase-Based Branching Model**:

```
main (production)
  │
  └── develop (integration)
        │
        ├── phase/0-before-dev
        ├── phase/1-architecture
        ├── phase/2-core-features
        └── phase/X-...
```

### Key Rules

1. **`main`** is production-only. Tagged releases. No direct commits.
2. **`develop`** is the integration branch. All phases merge here.
3. **`phase/*`** branches are never deleted after merge (audit trail).
4. All changes flow through Pull Requests with mandatory CI.
5. Phase PRs use merge commits; feature PRs use squash merge.

---

## Alternatives Considered

### 1. GitHub Flow (Single `main` Branch)

**Pros:**
- Simple, low overhead
- Fast iteration

**Cons:**
- No integration staging area
- Hard to coordinate multi-phase work
- Less audit trail

### 2. Standard Git Flow

**Pros:**
- Well-documented
- Supports hotfixes

**Cons:**
- Release branches add complexity
- Overkill for our deployment model
- More branch management overhead

### 3. Trunk-Based Development

**Pros:**
- Fastest feedback loop
- Forces small commits

**Cons:**
- Requires very mature CI/CD
- Less suitable for phased delivery
- Harder to audit discrete phases

---

## Consequences

### Positive

- **Auditability:** Phase branches preserved forever, easy to trace history
- **Stability:** `main` always deployable, protected by strict rules
- **Structure:** Clear phase boundaries in commit history
- **Quality:** Mandatory CI and review gates

### Negative

- **Branch Overhead:** More branches than GitHub Flow
- **Merge Discipline:** Requires team understanding of merge strategies
- **Training:** New contributors need to learn the model

### Mitigations

- Document branching model in CONTRIBUTING.md
- Use GitHub branch protection rules to enforce
- Provide automated PR templates

---

## References

- [A Successful Git Branching Model (Git Flow)](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Trunk-Based Development](https://trunkbaseddevelopment.com/)
