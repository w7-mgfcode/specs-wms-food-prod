# Phase 4 Security, Error Handling & Operations INITIAL Spec

> **Addendum to INITIAL-4.md**  
> Focus: Security decisions, error architecture, CI/CD, and production readiness  
> This document does NOT duplicate INITIAL-4.md content; it addresses orthogonal concerns.

---

## [ANALYZE] Problem Restatement

### Core Problem
The Phase 4 integration introduces new attack surfaces and operational complexity:
1. **Token security**: Where and how to store JWT tokens safely
2. **Error propagation**: How API errors flow from FastAPI → Client → UI
3. **CORS configuration**: Development vs production origin handling
4. **Type drift**: Keeping frontend types in sync with backend schemas
5. **CI/CD secrets**: Managing environment variables across environments

### Unknowns / Open Questions

| Question | Impact | Priority |
|----------|--------|----------|
| Should tokens persist across page refreshes? | UX vs Security tradeoff | High |
| How to handle 401 responses globally? | Auth flow coherence | High |
| Manual types vs generated types long-term? | Maintenance burden | Medium |
| Which origins need CORS in production? | Deployment flexibility | Medium |
| How to validate API contract in CI? | Regression prevention | Low |

### Relevant Dimensions

| Dimension | Considerations |
|-----------|----------------|
| **Security** | XSS, CSRF, token storage, credential exposure |
| **Data** | Type safety, schema drift, validation layers |
| **Cost** | Codegen tooling, CI minutes, developer time |
| **Scale** | Multi-environment deployments, CDN considerations |
| **DX** | Error debugging, devtools, local development |

---

## [BRAINSTORM] Alternative Approaches

### B1: Token Storage Strategies

| Strategy | XSS Risk | Persistence | CSRF Risk | Complexity |
|----------|----------|-------------|-----------|------------|
| **In-memory (Zustand)** | Low (token never in DOM/storage) | ❌ Lost on refresh | None | Low |
| **localStorage** | High (accessible via JS) | ✅ Persists | None | Low |
| **sessionStorage** | Medium (tab-scoped) | ⚠️ Tab only | None | Low |
| **HTTP-Only Cookie** | None (JS can't access) | ✅ Persists | High (needs CSRF) | High |
| **In-memory + Refresh Token** | Low | ✅ Via silent refresh | None | Medium |

**Mental Model**: "The more persistent the token, the larger the attack surface."

---

### B2: Error Handling Architectures

| Pattern | Description | Pro | Kontra |
|---------|-------------|-----|--------|
| **Per-component try/catch** | Each component handles its own errors | Fine-grained control | Duplicated logic, inconsistent UX |
| **TanStack Query onError** | Query-level error callbacks | Colocated with data fetching | Scattered across hooks |
| **Global Error Boundary** | React boundary catches all render errors | Single fallback UI | Can't distinguish error types |
| **QueryClient global handler** | `onError` in QueryClient defaults | Centralized, consistent | Hard to customize per-query |
| **Axios Interceptors (if used)** | Intercept responses globally | Pre-Query error handling | Adds Axios dependency |

**Analogies**:
- Per-component = "every room has its own fire extinguisher"
- Global boundary = "building-wide sprinkler system"
- QueryClient handler = "central fire station with dispatch"

---

### B3: Type Generation Workflows

| Workflow | Trigger | Pro | Kontra |
|----------|---------|-----|--------|
| **Manual types** | Developer writes by hand | Full control, no tooling | Drift risk, tedious |
| **CI codegen** | Every build regenerates types | Always fresh | CI complexity, build time |
| **Pre-commit hook** | Generate before commit | Types in repo | Forgetful developers |
| **On-demand script** | `npm run generate:api` | Flexible, explicit | Can be forgotten |
| **Watch mode** | Auto-regen on schema change | Instant feedback | Dev environment complexity |

---

### B4: CORS Configuration Models

| Model | Dev | Staging | Prod | Complexity |
|-------|-----|---------|------|------------|
| **Vite proxy only** | ✅ Proxy | ❌ Needs CORS | ❌ Needs CORS | Low (dev only) |
| **Explicit origins list** | Hardcoded origins per env | Medium | Medium | Medium |
| **Env-driven origins** | `ALLOWED_ORIGINS` env var | Flexible | Flexible | Medium |
| **Reverse proxy (nginx)** | Backend behind same origin | N/A | N/A | High (infra) |

---

## [RESEARCH] Best Practices & Anti-Patterns

### Security Best Practices

| Practice | Source | Recommendation |
|----------|--------|----------------|
| **Never store JWT in localStorage** | OWASP | ✅ Use in-memory or HTTP-only cookies |
| **Always validate on backend** | OWASP | ✅ Don't rely on frontend validation alone |
| **Use SameSite cookies** | MDN | ✅ If using cookies, set `SameSite=Strict` |
| **Short token expiry + refresh** | Auth0 | ✅ 15min access token, 7d refresh token |
| **CORS: never `["*"]` with credentials** | FastAPI docs | ✅ Explicit origin list |

### Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Alternative |
|--------------|--------------|-------------|
| Storing tokens in Redux/Zustand state that gets serialized | Persisted to storage, XSS vulnerable | Keep token in module-level variable |
| Catching errors silently | Users don't know what failed | Always surface or log errors |
| Hardcoding API URLs | Breaks across environments | Use env variables |
| Skipping error boundaries | Crash propagates to whole app | Wrap with QueryErrorResetBoundary |
| Manual CORS origin lists | Easy to forget new origins | Env-driven configuration |

### Risks & Uncertainties

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Token stolen via XSS | Low (if in-memory) | High | CSP headers, input sanitization |
| Type drift causes runtime errors | Medium | Medium | CI type generation, Zod validation |
| CORS misconfiguration blocks prod | Low | High | Pre-deploy checklist, staging tests |
| 401 cascade (expired token) | Medium | Medium | Global interceptor, silent refresh |
| Error boundary hides root cause | Medium | Low | Log errors before displaying fallback |

---

## [SYNTHESIS] Decision Directions

### S1: Security Layer Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Token storage** | In-memory (module variable) | Best XSS protection without cookie complexity |
| **Token persistence** | None (re-login on refresh) | Acceptable for internal ops tool; can add refresh tokens later |
| **CSRF protection** | Not needed | Bearer tokens aren't auto-sent by browser |
| **CORS origins** | Env-driven list | Flexible across environments without code changes |

**Trade-off Summary**: We sacrifice "stay logged in" UX for simpler, more secure architecture. This is acceptable for an internal food production WMS where operators log in once per shift.

---

### S2: Error Handling Layer Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Error class** | Custom `ApiClientError` | Typed errors with status, message, detail |
| **Global handling** | QueryClient `onError` + Error Boundary | Two-layer defense |
| **401 handling** | Redirect to login page | Clear auth failure UX |
| **403 handling** | Toast notification | Don't disrupt current view |
| **5xx handling** | Error boundary with retry | Recoverable server errors |

---

### S3: Type Safety Layer Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Type source** | Manual initially, codegen later | Get running fast, automate when stable |
| **Runtime validation** | Zod for critical paths | Defense against backend changes |
| **CI validation** | Optional: `generate:api` + diff check | Can add when schema stabilizes |

---

### S4: CI/CD Layer Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Secrets management** | GitHub Secrets → env injection | Standard, auditable |
| **Build-time env** | `.env.production` committed (non-sensitive) | Vite needs VITE_* at build time |
| **API URL** | Env-driven, not hardcoded | Same build artifact, different configs |
| **CORS origins** | Backend env: `ALLOWED_ORIGINS` | No code change for new origins |

---

## [SPECIFICATION] Final Decisions

### What We Decided

The Phase 4 integration adopts a **security-first, simplicity-oriented** approach. JWT tokens are stored in a module-level variable (not localStorage or Zustand state) to minimize XSS risk while accepting that users must re-authenticate on page refresh. This is acceptable for an internal production floor application where operators log in once per shift.

Error handling uses a two-layer strategy: `ApiClientError` provides typed errors at the client level, while a `QueryErrorResetBoundary` catches and displays React-level failures. Global 401 responses trigger automatic redirect to login, maintaining auth flow coherence without per-component logic.

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   React     │───▶│  TanStack   │───▶│   API Client        │  │
│  │ Components  │    │   Query     │    │   (client.ts)       │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│         │                 │                      │              │
│         ▼                 ▼                      ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Error     │    │ QueryClient │    │   Token Storage     │  │
│  │  Boundary   │    │  onError    │    │   (in-memory)       │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Vite Proxy (dev)                     │    │
│  │                  VITE_API_URL (prod)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   CORS      │───▶│   Auth      │───▶│   Endpoints         │  │
│  │ Middleware  │    │ Middleware  │    │   (routes/*.py)     │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                                                                 │
│  ALLOWED_ORIGINS = env("ALLOWED_ORIGINS").split(",")            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **Token Store** | `src/lib/api/client.ts` | Module-level `authToken` variable |
| **ApiClientError** | `src/lib/api/client.ts` | Typed error class with status/message/detail |
| **QueryClient defaults** | `src/main.tsx` | Global retry, staleTime, gcTime settings |
| **QueryErrorBoundary** | `src/components/ErrorBoundary.tsx` | React error boundary for query failures |
| **Global 401 handler** | `src/lib/api/client.ts` | Redirect to `/login` on 401 |
| **CORS config** | `backend/app/main.py` | Env-driven `ALLOWED_ORIGINS` |
| **Type generation** | `package.json` script | On-demand `npm run generate:api` |

### Open Questions

| Question | Owner | Due | Notes |
|----------|-------|-----|-------|
| Add refresh token flow later? | Team | Post-Phase 4 | Depends on UX feedback |
| Enable CSP headers? | DevOps | Phase 5 | Requires header audit |
| Zod validation on all responses? | Frontend | Phase 4 M2 | Start with auth/lots |
| CI type diff check? | DevOps | Post-Phase 4 | When schema stabilizes |

### Next Steps

1. **M0**: Implement in-memory token storage in `client.ts`
2. **M0**: Add global 401 handling with redirect
3. **M1**: Create `ApiClientError` class with proper typing
4. **M1**: Add `QueryErrorBoundary` component
5. **M2**: Implement env-driven CORS in FastAPI (`ALLOWED_ORIGINS`)
6. **M3**: Add `generate:api` npm script for future use
7. **M4**: Document refresh token upgrade path for future consideration

---

## Constraints + Examples (Spec Format)

### Constraints

- **Token storage**: MUST be in-memory (module variable); MUST NOT use localStorage, sessionStorage,
  or serialized Zustand state.
- **Error handling**: All API errors MUST throw `ApiClientError`; components MUST be wrapped in
  `QueryErrorBoundary`.
- **401 responses**: MUST trigger redirect to `/login`; MUST clear stored token.
- **CORS origins**: MUST be environment-driven; MUST NOT use wildcard `["*"]` with credentials.
- **Type safety**: Manual types acceptable for M0-M2; codegen recommended for M3+.

### Examples

#### Token Storage (Correct)

```typescript
// ✅ CORRECT: Module-level variable
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}
```

#### Token Storage (Incorrect)

```typescript
// ❌ WRONG: Zustand state (may be persisted)
const useAuthStore = create(
  persist(
    (set) => ({
      token: null, // This gets saved to localStorage!
    }),
    { name: 'auth-storage' }
  )
);
```

#### Global 401 Handler

```typescript
// In client.ts
if (response.status === 401) {
  setAuthToken(null);
  window.location.href = '/login';
  throw new ApiClientError(401, 'Session expired');
}
```

#### CORS Configuration

```python
# backend/app/main.py
import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Research Options (Summary from Brainstorm)

1. **In-memory token + re-login on refresh** (CHOSEN)
2. **HTTP-Only cookie with CSRF tokens** (Rejected: complexity)
3. **In-memory + silent refresh flow** (Deferred: future enhancement)
4. **localStorage with short expiry** (Rejected: XSS risk)

---

## Tradeoffs (Cost / Risk / Time)

| Decision | Cost | Risk | Time | Notes |
|----------|------|------|------|-------|
| In-memory token | Low | Low | Short | Simple, secure, slightly worse UX |
| Global 401 redirect | Low | Low | Short | Consistent auth flow |
| Manual types initially | Low | Medium | Short | Drift risk, but fast to start |
| Env-driven CORS | Low | Low | Short | Flexible, no code changes |
| QueryErrorBoundary | Low | Low | Medium | Extra component, good UX |

---

## MVP Decision

### Chosen: In-Memory Token + Two-Layer Error Handling + Env-Driven CORS

This combination provides:
- Maximum XSS protection with minimal complexity
- Consistent error UX across the application
- Flexible deployment without code changes
- Clear upgrade path for future enhancements (refresh tokens, CSP)

---

## Milestones

1. **M0: Token Security**
   - Implement in-memory token storage
   - Add global 401 redirect handler
   - Remove any localStorage/sessionStorage usage

2. **M1: Error Architecture**
   - Create `ApiClientError` class
   - Add `QueryErrorBoundary` component
   - Configure QueryClient global `onError`

3. **M2: CORS Production-Ready**
   - Add `ALLOWED_ORIGINS` env variable to FastAPI
   - Document required origins per environment
   - Test staging CORS configuration

4. **M3: Type Safety Automation**
   - Add `npm run generate:api` script
   - Document on-demand regeneration workflow
   - Optional: Add CI diff check

5. **M4: Monitoring & Logging**
   - Add error logging to global handler
   - Document error patterns for observability
   - Create runbook for common error scenarios

---

## Validation Checkpoints

- **Token security**: Confirm token NOT in localStorage/sessionStorage/devtools state.
- **401 handling**: Simulate expired token, verify redirect to `/login`.
- **Error boundary**: Trigger 500 error, verify recovery UI appears.
- **CORS staging**: Deploy to staging, verify cross-origin requests work.
- **Type generation**: Run `generate:api`, verify output matches manual types.

---

## Final Deliverables

- **Updated `client.ts`**: In-memory token storage + global 401 handler
- **`ErrorBoundary.tsx`**: React error boundary with Query reset
- **Updated `main.py`**: Env-driven CORS origins
- **`package.json` script**: `generate:api` for type generation
- **Environment documentation**: Required variables per environment
- **Runbook**: Common error scenarios and resolution steps
