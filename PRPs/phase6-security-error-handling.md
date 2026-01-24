# PRP: Phase 4 Security, Error Handling & Operations

> **Version**: 1.0.0
> **Status**: Ready for Implementation
> **Confidence Score**: 9/10
> **Estimated Complexity**: Medium
> **Addendum To**: `PRPs/phase4-frontend-fastapi-integration.md`

---

## Purpose

Implement security hardening, two-layer error handling architecture, env-driven CORS configuration, and type generation automation for the Phase 6 Frontend → FastAPI integration. This PRP focuses on the orthogonal concerns not covered in the main integration PRP.

## Core Principles

1. **Security First**: In-memory JWT storage to minimize XSS attack surface
2. **Two-Layer Error Defense**: API client errors + React error boundaries
3. **Env-Driven Configuration**: No hardcoded origins or URLs
4. **Graceful Degradation**: Users see helpful errors, not white screens
5. **Production Readiness**: Proper CORS, logging, and monitoring foundations

---

## Goal

Implement:
1. **M0: Token Security** — In-memory token storage with global 401 redirect
2. **M1: Error Architecture** — `ApiClientError` class + `QueryErrorBoundary` component
3. **M2: CORS Production-Ready** — Env-driven `ALLOWED_ORIGINS` in FastAPI
4. **M3: Type Safety Automation** — `npm run generate:api` script
5. **M4: Monitoring & Logging** — Error logging and runbook documentation

## Why

The Phase 4 integration introduces new attack surfaces:
- **Token storage**: localStorage is XSS-vulnerable; current `useAuthStore.ts` has no token storage
- **Error propagation**: No centralized error handling; errors caught inconsistently
- **CORS**: Current backend uses hardcoded `["*"]` in debug mode
- **Type drift**: Manual types may diverge from backend schemas

This PRP addresses these gaps with a security-first approach acceptable for an internal food production WMS.

---

## What

### Deliverables

| Component | File | Action |
|-----------|------|--------|
| **Token Storage** | `src/lib/api/client.ts` | Module-level variable + 401 handler |
| **Error Class** | `src/lib/api/client.ts` | `ApiClientError` with status/detail |
| **Error Boundary** | `src/components/ErrorBoundary.tsx` | QueryErrorResetBoundary wrapper |
| **CORS Config** | `backend/app/config.py` | `allowed_origins` setting |
| **CORS Middleware** | `backend/app/main.py` | Env-driven origins |
| **Type Generation** | `package.json` | `generate:api` script |
| **Environment Docs** | `docs/ENVIRONMENT.md` | Required variables per env |
| **Runbook** | `docs/RUNBOOK.md` | Common error scenarios |

### Success Criteria

- [ ] Token NOT in localStorage/sessionStorage (verified via devtools)
- [ ] 401 response triggers redirect to `/login` and clears token
- [ ] 403 response shows toast notification (doesn't navigate)
- [ ] 5xx response shows error boundary with retry button
- [ ] CORS works with `ALLOWED_ORIGINS` env variable
- [ ] `npm run generate:api` produces types from FastAPI OpenAPI
- [ ] TypeScript `npm run build` passes with zero errors

---

## All Needed Context

### Current State Analysis

**Backend CORS (`backend/app/main.py:36-42`):**
```python
# Current (PROBLEMATIC):
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.debug else ["https://flowviz.example.com"],
    allow_credentials=not settings.debug,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
**Issue**: Hardcoded production origin; no env-driven configuration.

**Backend Config (`backend/app/config.py`):**
```python
class Settings(BaseSettings):
    # Missing: allowed_origins setting
    environment: str = "development"
    debug: bool = True
```
**Issue**: No `allowed_origins` field for CORS configuration.

**Frontend Auth Store (`flow-viz-react/src/stores/useAuthStore.ts:44-58`):**
```typescript
// Current postgres mode login:
const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
});
const data = await response.json();
set({ user: data.user, role: data.user.role, ... });
```
**Issue**: No JWT token storage; token from response is discarded.

**Frontend Main Entry (`flow-viz-react/src/main.tsx`):**
```typescript
// Current:
<RouterProvider router={router} />
```
**Issue**: No `QueryClientProvider`, no error boundary.

**Toast Store (`flow-viz-react/src/stores/useToastStore.ts`):**
```typescript
// Already exists with proper types
addToast: (message, type = 'info', duration = 3000) => { ... }
```
**Available**: Can use for 403 notifications.

### TanStack Query v5 Error Boundary Pattern

**Documentation**: https://tanstack.com/query/v5/docs/framework/react/reference/useQueryErrorResetBoundary

**Recommended Pattern (2025):**
```tsx
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

export function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={reset}
        >
          <RouterProvider router={router} />
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

**v5 Key Changes:**
- `useErrorBoundary` → `throwOnError` (renamed)
- `Error` is now default type instead of `unknown`
- Requires React 18.0+ (project uses React 19 ✓)

### openapi-typescript Type Generation

**Documentation**: https://github.com/openapi-ts/openapi-typescript

**Usage:**
```bash
# Generate types from FastAPI OpenAPI endpoint
npx openapi-typescript http://localhost:8000/openapi.json -o src/lib/api/schema.d.ts
```

**Alternative (Hey API)**: https://fastapi.tiangolo.com/advanced/generate-clients/
```bash
npx @hey-api/openapi-ts -i http://localhost:8000/openapi.json -o src/client
```

### Security Best Practices

| Practice | Implementation |
|----------|----------------|
| Never localStorage for JWT | Module-level variable in `client.ts` |
| Short token expiry | Backend already: `jwt_expire_minutes: int = 30` |
| CORS explicit origins | Env-driven `ALLOWED_ORIGINS` |
| Credentials with explicit origins | `allow_credentials=True` only with explicit list |

**OWASP Reference**: In-memory storage is recommended for sensitive tokens to prevent XSS exfiltration.

---

## Implementation Blueprint

### File Structure (New/Modified)

```
flow-viz-react/src/
├── lib/
│   └── api/
│       └── client.ts       # MODIFY: Add token manager + 401 handler
├── components/
│   └── ErrorBoundary.tsx   # CREATE: QueryErrorResetBoundary wrapper
├── main.tsx                # MODIFY: Add QueryClientProvider + ErrorBoundary
└── package.json            # MODIFY: Add generate:api script

backend/app/
├── config.py               # MODIFY: Add allowed_origins setting
└── main.py                 # MODIFY: Use env-driven CORS

docs/
├── ENVIRONMENT.md          # CREATE: Environment variables documentation
└── RUNBOOK.md              # CREATE: Error scenarios and resolution
```

### Implementation Tasks (Ordered)

```yaml
Task 1 - Token Security (M0):
  files:
    - flow-viz-react/src/lib/api/client.ts (MODIFY)
  changes:
    - Add module-level authToken variable
    - Add tokenManager object with get/set/clear/has methods
    - Add global 401 handler that clears token + redirects
    - Add global 403 handler that shows toast
  validation: |
    cd flow-viz-react && npx tsc --noEmit

Task 2 - ApiClientError Class (M1):
  files:
    - flow-viz-react/src/lib/api/client.ts (MODIFY)
  changes:
    - Create ApiClientError class extending Error
    - Include status, detail, body properties
    - Use in apiFetch error handling
  validation: |
    cd flow-viz-react && npx tsc --noEmit

Task 3 - Error Boundary Component (M1):
  files:
    - flow-viz-react/src/components/ErrorBoundary.tsx (CREATE)
  changes:
    - Create ErrorFallback component with retry button
    - Export QueryErrorBoundary wrapper component
  validation: |
    cd flow-viz-react && npx tsc --noEmit

Task 4 - Integrate Error Boundary (M1):
  files:
    - flow-viz-react/src/main.tsx (MODIFY)
  changes:
    - Import QueryErrorResetBoundary from @tanstack/react-query
    - Wrap RouterProvider with error boundary
    - Add QueryClientProvider (if not already from phase4 PRP)
  validation: |
    cd flow-viz-react && npm run build

Task 5 - QueryClient Global Error Handler (M1):
  files:
    - flow-viz-react/src/lib/queryClient.ts (MODIFY)
  changes:
    - Add global onError handler to mutations
    - Log errors before displaying
    - Handle 401/403/5xx differently
  validation: |
    cd flow-viz-react && npm run build

Task 6 - Backend CORS Config (M2):
  files:
    - backend/app/config.py (MODIFY)
    - backend/app/main.py (MODIFY)
  changes:
    - Add allowed_origins: str field to Settings
    - Parse comma-separated string to list
    - Use in CORSMiddleware
  validation: |
    cd backend && uv run ruff check app/
    cd backend && uv run mypy app/

Task 7 - Type Generation Script (M3):
  files:
    - flow-viz-react/package.json (MODIFY)
  changes:
    - Add openapi-typescript as devDependency
    - Add generate:api script
  validation: |
    cd flow-viz-react && npm install
    # Note: generate:api requires backend running

Task 8 - Documentation (M4):
  files:
    - docs/ENVIRONMENT.md (CREATE)
    - docs/RUNBOOK.md (CREATE)
  changes:
    - Document all environment variables
    - Document common error scenarios
  validation: |
    test -f docs/ENVIRONMENT.md && test -f docs/RUNBOOK.md
```

---

## Code Snippets (Implementation Reference)

### Task 1 & 2: Token Security + ApiClientError

**src/lib/api/client.ts:**
```typescript
/**
 * API Client with JWT token management and global error handling
 *
 * Security: Token stored in memory (module closure) for XSS protection.
 * Never stored in localStorage or sessionStorage.
 */

// ============ Token Storage (Module-level for XSS protection) ============

let authToken: string | null = null;

export const tokenManager = {
  getToken: () => authToken,
  setToken: (token: string | null) => { authToken = token; },
  clearToken: () => { authToken = null; },
  hasToken: () => authToken !== null,
};

// ============ Error Class ============

/**
 * Custom error class for API errors with typed properties
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly body?: unknown
  ) {
    super(detail);
    this.name = 'ApiClientError';
    // Maintains proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiClientError);
    }
  }

  /** Check if this is an authentication error */
  isAuthError(): boolean {
    return this.status === 401;
  }

  /** Check if this is a permission error */
  isPermissionError(): boolean {
    return this.status === 403;
  }

  /** Check if this is a server error */
  isServerError(): boolean {
    return this.status >= 500;
  }
}

// ============ API Client ============

function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Handle global error responses (401, 403, etc.)
 * Called before throwing ApiClientError
 */
function handleGlobalErrors(status: number, detail: string): void {
  if (status === 401) {
    // Clear token and redirect to login
    tokenManager.clearToken();
    // Use hash router path
    window.location.href = '/#/login';
  }
  // 403 is handled at QueryClient level with toast
  // 5xx is handled by error boundary
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options || {};
  const headers = new Headers(fetchOptions?.headers);

  // Inject JWT token if available and not skipped
  const token = tokenManager.getToken();
  if (token && !skipAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set content type for JSON requests
  if (fetchOptions?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, { ...fetchOptions, headers });

  // Handle non-2xx responses
  if (!response.ok) {
    let detail = 'Request failed';
    let body: unknown;

    try {
      body = await response.json();
      detail = (body as { detail?: string })?.detail || detail;
    } catch {
      // Response wasn't JSON
    }

    // Handle global error patterns (401 redirect, etc.)
    handleGlobalErrors(response.status, detail);

    throw new ApiClientError(response.status, detail, body);
  }

  // Return parsed JSON (or empty object for 204)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
```

### Task 3: Error Boundary Component

**src/components/ErrorBoundary.tsx:**
```typescript
import { ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { ApiClientError } from '../lib/api/client';

/**
 * Error fallback UI shown when an error boundary catches an error
 */
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isServerError = error instanceof ApiClientError && error.isServerError();
  const errorMessage = error instanceof ApiClientError
    ? error.detail
    : error.message || 'An unexpected error occurred';

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mb-4 text-6xl">
          {isServerError ? '🔧' : '⚠️'}
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          {isServerError ? 'Server Error' : 'Something went wrong'}
        </h2>
        <p className="mb-6 text-gray-600">
          {errorMessage}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
        >
          Try Again
        </button>
        {isServerError && (
          <p className="mt-4 text-sm text-gray-500">
            If the problem persists, please contact support.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Log error before displaying fallback UI
 */
function logError(error: Error, info: { componentStack?: string | null }) {
  // Log to console in development
  console.error('Error caught by boundary:', error);
  if (info.componentStack) {
    console.error('Component stack:', info.componentStack);
  }
  // TODO: Send to error tracking service in production
}

interface QueryErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Error boundary wrapper that integrates with TanStack Query
 * Resets query errors when user clicks "Try Again"
 */
export function QueryErrorBoundary({ children }: QueryErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ReactErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={reset}
          onError={logError}
        >
          {children}
        </ReactErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

### Task 4: Main Entry Update

**src/main.tsx:**
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { router } from './router';
import { queryClient } from './lib/queryClient';
import { QueryErrorBoundary } from './components/ErrorBoundary';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <QueryErrorBoundary>
        <RouterProvider router={router} />
      </QueryErrorBoundary>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
);
```

### Task 5: QueryClient Global Error Handler

**src/lib/queryClient.ts:**
```typescript
import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api/client';
import { useToastStore } from '../stores/useToastStore';

/**
 * Global error handler for mutations
 * Handles different error types appropriately
 */
function handleMutationError(error: Error): void {
  // Log all errors
  console.error('Mutation error:', error);

  if (error instanceof ApiClientError) {
    // 401 is handled globally in client.ts (redirect)
    if (error.isAuthError()) {
      return; // Already redirected
    }

    // 403: Show toast, don't disrupt view
    if (error.isPermissionError()) {
      useToastStore.getState().addToast(
        'You do not have permission to perform this action',
        'error',
        5000
      );
      return;
    }

    // 5xx: Let error boundary handle it (if throwOnError is set)
    // Otherwise show toast
    if (error.isServerError()) {
      useToastStore.getState().addToast(
        'Server error. Please try again later.',
        'error',
        5000
      );
      return;
    }

    // 4xx (other): Show specific error message
    useToastStore.getState().addToast(error.detail, 'error', 5000);
  } else {
    // Unknown error
    useToastStore.getState().addToast(
      'An unexpected error occurred',
      'error',
      5000
    );
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: import.meta.env.PROD,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof ApiClientError && error.status < 500) {
          return false;
        }
        // Retry up to 2 times on 5xx
        return failureCount < 2;
      },
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: false,
      onError: handleMutationError,
    },
  },
});

// Query key factories
export const queryKeys = {
  lots: {
    all: ['lots'] as const,
    lists: () => [...queryKeys.lots.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.lots.all, 'detail', id] as const,
  },
  qc: {
    all: ['qc-decisions'] as const,
    byLot: (lotId: string) => [...queryKeys.qc.all, 'lot', lotId] as const,
  },
  traceability: {
    all: ['traceability'] as const,
    lot: (lotCode: string) => [...queryKeys.traceability.all, lotCode] as const,
  },
} as const;
```

### Task 6: Backend CORS Configuration

**backend/app/config.py (add to Settings class):**
```python
class Settings(BaseSettings):
    # ... existing fields ...

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        """Parse allowed_origins string to list."""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
```

**backend/app/main.py (replace CORS middleware):**
```python
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="FlowViz WMS API",
        description="Food Production Warehouse Management System API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # CORS middleware - env-driven origins
    # Note: allow_credentials=True requires explicit origin list (not ["*"])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ... rest of function
```

### Task 7: Type Generation Script

**package.json (add to devDependencies and scripts):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "generate:api": "openapi-typescript http://localhost:8000/openapi.json -o src/lib/api/schema.d.ts"
  },
  "devDependencies": {
    "openapi-typescript": "^7.0.0"
  }
}
```

### Task 8: Documentation

**docs/ENVIRONMENT.md:**
```markdown
# Environment Variables

## Frontend (Vite)

All frontend variables must be prefixed with `VITE_` to be exposed to the client.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | (empty) | API base URL. Empty in dev (uses Vite proxy). |
| `VITE_DB_MODE` | No | `mock` | Database mode: `mock`, `postgres`, `supabase` |

### Development (.env.development)
```
VITE_API_URL=
VITE_DB_MODE=postgres
```

### Production (.env.production)
```
VITE_API_URL=https://api.flowviz.example.com
VITE_DB_MODE=postgres
```

## Backend (FastAPI)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes (prod) | localhost | PostgreSQL connection string |
| `SECRET_KEY` | Yes (prod) | INSECURE-DEV | JWT signing key (min 32 chars in prod) |
| `ALLOWED_ORIGINS` | No | localhost:5173 | Comma-separated CORS origins |
| `DEBUG` | No | `true` | Enable debug mode |
| `ENVIRONMENT` | No | `development` | Environment name |

### Development
```
DATABASE_URL=postgresql+asyncpg://admin:password@localhost:5432/flowviz
SECRET_KEY=dev-secret-key-not-for-production
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
DEBUG=true
ENVIRONMENT=development
```

### Production
```
DATABASE_URL=postgresql+asyncpg://user:pass@prod-db:5432/flowviz
SECRET_KEY=<secure-random-string-min-32-chars>
ALLOWED_ORIGINS=https://flowviz.example.com,https://staging.flowviz.example.com
DEBUG=false
ENVIRONMENT=production
```
```

**docs/RUNBOOK.md:**
```markdown
# Error Scenarios Runbook

## Authentication Errors (401)

### Symptom
User is redirected to login page unexpectedly.

### Cause
- JWT token expired (30 min default)
- Token was cleared manually
- Page was refreshed (tokens are in-memory)

### Resolution
1. User logs in again
2. For frequent issues, consider implementing refresh tokens (future enhancement)

---

## Permission Errors (403)

### Symptom
Toast notification: "You do not have permission to perform this action"

### Cause
User's role doesn't have access to the requested resource.

### Resolution
1. Verify user has correct role (ADMIN, MANAGER, OPERATOR, AUDITOR, VIEWER)
2. Contact administrator to update role if needed

---

## Server Errors (5xx)

### Symptom
Error boundary with "Server Error" message and retry button.

### Cause
- Backend service unavailable
- Database connection issue
- Unhandled exception in backend

### Resolution
1. Check backend logs: `docker logs flowviz-api`
2. Verify database is running: `docker ps | grep postgres`
3. Check backend health: `curl http://localhost:8000/api/health`

---

## CORS Errors

### Symptom
Browser console: "Access to fetch has been blocked by CORS policy"

### Cause
Frontend origin not in `ALLOWED_ORIGINS` list.

### Resolution
1. Add origin to `ALLOWED_ORIGINS` env variable
2. Restart backend: `docker restart flowviz-api`
3. Verify: `curl -I -X OPTIONS http://localhost:8000/api/health -H "Origin: http://your-origin"`

---

## Type Generation Issues

### Symptom
`npm run generate:api` fails or produces incorrect types.

### Cause
- Backend not running
- OpenAPI schema has validation errors
- Network connectivity issue

### Resolution
1. Start backend: `cd backend && uv run uvicorn app.main:app --reload`
2. Verify OpenAPI available: `curl http://localhost:8000/openapi.json`
3. Run generation: `npm run generate:api`
```

---

## Validation Gates

### Level 1: TypeScript Compilation

```bash
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/flow-viz-react

# Check all files compile
npx tsc --noEmit && echo "✓ TypeScript compiles"

# ESLint
npm run lint && echo "✓ ESLint passes"

# Build
npm run build && echo "✓ Production build succeeds"
```

### Level 2: Backend Validation

```bash
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/backend

# Ruff linting
uv run ruff check app/ && echo "✓ Ruff passes"

# Mypy type checking
uv run mypy app/ && echo "✓ Mypy passes"

# Test CORS config loads
uv run python -c "from app.config import settings; print('CORS origins:', settings.cors_origins)"
```

### Level 3: Security Verification

```bash
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/flow-viz-react

# Verify no localStorage/sessionStorage usage for tokens
! grep -r "localStorage\|sessionStorage" src/lib/api/ && echo "✓ No storage API usage in api/"

# Verify token in module scope
grep -q "let authToken: string | null = null" src/lib/api/client.ts && echo "✓ Token is module-level"

# Verify 401 handler exists
grep -q "status === 401" src/lib/api/client.ts && echo "✓ 401 handler exists"
```

### Level 4: Documentation Verification

```bash
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2

# Check documentation files exist
test -f docs/ENVIRONMENT.md && echo "✓ ENVIRONMENT.md exists"
test -f docs/RUNBOOK.md && echo "✓ RUNBOOK.md exists"
```

### Level 5: Integration Test (Manual)

```markdown
## Manual E2E Security Test Checklist

### Token Security
- [ ] Login via /login page
- [ ] Open DevTools → Application → Local Storage: NO token present
- [ ] Open DevTools → Application → Session Storage: NO token present
- [ ] Check Redux/Zustand devtools: NO token in state
- [ ] Refresh page: User is logged out (expected - in-memory only)

### 401 Handling
- [ ] Login successfully
- [ ] Wait 30+ minutes (token expiry) OR manually clear token
- [ ] Try an authenticated action
- [ ] Verify: Redirected to /login automatically

### 403 Handling
- [ ] Login as VIEWER role
- [ ] Try to create a lot (requires OPERATOR+)
- [ ] Verify: Toast shows "You do not have permission..."
- [ ] Verify: NOT redirected, stays on current page

### 5xx Handling
- [ ] Stop backend server
- [ ] Trigger a query that would fetch data
- [ ] Verify: Error boundary shows with "Server Error"
- [ ] Click "Try Again"
- [ ] Start backend
- [ ] Verify: Data loads after retry

### CORS
- [ ] Set ALLOWED_ORIGINS=http://localhost:5173
- [ ] Start backend
- [ ] Start frontend on 5173
- [ ] Verify: API calls work
- [ ] Change frontend port to 5174
- [ ] Verify: CORS error in console
- [ ] Add 5174 to ALLOWED_ORIGINS
- [ ] Restart backend
- [ ] Verify: API calls work again
```

---

## Dependencies to Add

### Frontend
```bash
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/flow-viz-react

# Error boundary library
npm install react-error-boundary

# Type generation (dev only)
npm install -D openapi-typescript

# React Query Devtools (dev only) - may already exist from phase4 PRP
npm install -D @tanstack/react-query-devtools
```

### Backend
No new dependencies needed.

---

## Anti-Patterns to Avoid

### Security
- ❌ Never store JWT in localStorage/sessionStorage
- ❌ Never store token in Zustand state with `persist` middleware
- ❌ Never use `CORS allow_origins=["*"]` with `allow_credentials=True`
- ❌ Never hardcode production URLs

### Error Handling
- ❌ Don't catch errors silently (always log or surface)
- ❌ Don't show raw error objects to users
- ❌ Don't forget to reset query state on error retry
- ❌ Don't handle 401 per-component (use global handler)

### Types
- ❌ Don't manually update types without regenerating from OpenAPI
- ❌ Don't use `any` for API responses

---

## Rollback Strategy

If implementation causes issues:

1. **Token issues**: Remove 401 handler, revert to simple token-less flow
2. **Error boundary breaks**: Remove `QueryErrorBoundary` wrapper from main.tsx
3. **CORS breaks**: Revert to `["*"]` with `allow_credentials=False` temporarily
4. **Type generation issues**: Manual types still work; script is optional

---

## References

### Official Documentation
- [TanStack Query Error Boundaries](https://tanstack.com/query/v5/docs/framework/react/reference/useQueryErrorResetBoundary)
- [react-error-boundary](https://github.com/bvaughn/react-error-boundary)
- [openapi-typescript](https://github.com/openapi-ts/openapi-typescript)
- [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)

### Security Resources
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [JWT in Memory Pattern](https://github.com/marmelab/ra-in-memory-jwt)

### Project Files (Existing)
- `backend/app/main.py` — Current CORS configuration
- `backend/app/config.py` — Settings class
- `flow-viz-react/src/stores/useToastStore.ts` — Toast notifications
- `flow-viz-react/src/stores/useAuthStore.ts` — Current auth implementation

---

## Confidence Score: 9/10

**Strengths:**
- Clear security requirements from INITIAL-5.md spec
- Well-documented TanStack Query error boundary patterns
- Existing toast store ready for 403 notifications
- Straightforward CORS configuration change

**Risks:**
- react-error-boundary is new dependency (but well-maintained)
- Type generation requires backend running (documented in runbook)
- Hash router complicates 401 redirect slightly (handled)

**Mitigation:**
- All changes are additive, easy to rollback
- Comprehensive manual testing checklist
- Documentation for ongoing maintenance
