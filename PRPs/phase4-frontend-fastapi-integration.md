# PRP: Phase 4 Frontend → FastAPI Integration

> **Version**: 1.0.0
> **Status**: Ready for Implementation
> **Confidence Score**: 9/10
> **Estimated Complexity**: Medium

---

## Purpose

Integrate the React 19 frontend with the FastAPI backend, replacing the legacy Supabase/mock data adapters with a proper API client layer using TanStack Query for server state management and JWT-based authentication with in-memory token storage.

## Core Principles

1. **Hybrid API Client Pattern**: Generate types from OpenAPI schema, write thin fetch wrapper manually
2. **Server State Separation**: Zustand holds only UI/auth state; TanStack Query manages all server data
3. **Security First**: JWT tokens stored in memory (not localStorage) to prevent XSS attacks
4. **Type Safety**: Full TypeScript coverage with Zod runtime validation where needed
5. **Minimal Changes**: Work with existing FastAPI endpoints without backend modifications

---

## Goal

Create a robust API client layer that:
- Integrates seamlessly with existing FastAPI endpoints (`/api/login`, `/api/lots`, `/api/qc-decisions`, `/api/traceability/{lot_code}`, `/api/health`)
- Uses TanStack Query v5 for caching, mutations, and automatic invalidation
- Stores JWT tokens securely in memory with proper auth header injection
- Maintains full type safety with TypeScript interfaces matching backend Pydantic schemas
- Provides clean migration path from current Supabase/mock adapters

## Why

The current frontend uses a fragmented data access pattern:
- `src/lib/supabase.ts` — Supabase client (optional)
- `src/lib/db.ts` — Database adapter with mock/postgres/supabase modes
- Direct fetch calls in `useAuthStore.ts`
- Optimistic updates mixed with store state

This creates issues:
- Inconsistent error handling across data sources
- No centralized caching or request deduplication
- JWT token handling is incomplete (no refresh, no secure storage)
- Hard to test and debug

The Phase 4 integration provides:
- Centralized API client with consistent error handling
- TanStack Query cache with automatic invalidation on mutations
- Secure JWT storage in memory (XSS protection)
- Clean separation: Zustand = UI state, TanStack Query = server state

---

## What

### Integration Scope

| Component | Action | Details |
|-----------|--------|---------|
| **Vite Config** | Update | Proxy `/api` to `localhost:8000` |
| **Environment** | Create | `.env.development`, `.env.production` |
| **API Client** | Create | `src/lib/api/client.ts` with JWT injection |
| **API Types** | Create | `src/lib/api/types.ts` matching backend schemas |
| **API Modules** | Create | `auth.ts`, `lots.ts`, `qc.ts`, `traceability.ts` |
| **Query Hooks** | Create | `src/hooks/useLots.ts`, `useQC.ts`, `useTraceability.ts` |
| **Auth Store** | Migrate | Update to use new API client, in-memory token |
| **Main Entry** | Update | Add `QueryClientProvider` |
| **Legacy Files** | Deprecate | Mark `src/lib/db.ts`, `src/lib/supabase.ts` as deprecated |

### Success Criteria

- [ ] `curl http://localhost:5173/api/health` returns FastAPI response (proxy works)
- [ ] Login stores JWT in memory, not localStorage
- [ ] All API requests include `Authorization: Bearer <token>` header
- [ ] Creating a lot triggers automatic `invalidateQueries` for lots list
- [ ] TypeScript `npm run build` passes with zero errors
- [ ] Browser console clean during normal operation
- [ ] No frame drops or layout thrash with target data volume

---

## All Needed Context

### FastAPI Backend Endpoints (Existing - DO NOT MODIFY)

```yaml
# Reference: backend/app/api/routes/__init__.py
endpoints:
  health:
    method: GET
    path: /api/health
    response: { status: "ok", timestamp: "<ISO8601>" }
    auth: None

  login:
    method: POST
    path: /api/login
    request: { email: string }
    response: { user: UserResponse, token: string }
    auth: None

  lots:
    method: POST
    path: /api/lots
    request: LotCreate
    response: LotResponse (201 Created)
    auth: Optional (for now)

  qc_decisions:
    method: POST
    path: /api/qc-decisions
    request: QCDecisionCreate
    response: QCDecisionResponse (201 Created)
    auth: Optional (for now)
    validation: HOLD/FAIL require notes (min 10 chars)

  traceability:
    method: GET
    path: /api/traceability/{lot_code}
    response: { central: LotResponse, parents: LotResponse[], children: LotResponse[] }
    auth: Optional (for now)
    error: 404 if lot not found
```

### Backend Pydantic Schemas (Reference for TypeScript types)

```python
# backend/app/schemas/user.py
class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    role: UserRole  # 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER'
    created_at: datetime
    last_login: Optional[datetime] = None

class LoginResponse(BaseModel):
    user: UserResponse
    token: str

# backend/app/schemas/lot.py
class LotCreate(BaseModel):
    lot_code: str = Field(..., min_length=1, max_length=100)
    lot_type: Optional[LotType] = None  # 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG'
    production_run_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    weight_kg: Optional[Decimal] = Field(None, ge=0, le=10000)
    temperature_c: Optional[Decimal] = Field(None, ge=-50, le=100)
    metadata: Optional[dict[str, Any]] = None

class LotResponse(BaseModel):
    id: UUID
    lot_code: str
    lot_type: Optional[LotType] = None
    production_run_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    weight_kg: Optional[Decimal] = None
    temperature_c: Optional[Decimal] = None
    metadata: dict[str, Any]
    created_at: datetime

# backend/app/schemas/qc.py
class QCDecisionCreate(BaseModel):
    lot_id: Optional[UUID] = None
    qc_gate_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    decision: Optional[Decision] = None  # 'PASS' | 'HOLD' | 'FAIL'
    notes: Optional[str] = Field(None, max_length=1000)
    temperature_c: Optional[Decimal] = Field(None, ge=-50, le=100)
    digital_signature: Optional[str] = None
    # Validation: HOLD/FAIL require notes (min 10 chars)

class QCDecisionResponse(BaseModel):
    id: UUID
    lot_id: Optional[UUID] = None
    qc_gate_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    decision: Optional[Decision] = None
    notes: Optional[str] = None
    temperature_c: Optional[Decimal] = None
    digital_signature: Optional[str] = None
    decided_at: datetime

# backend/app/schemas/traceability.py
class TraceabilityResponse(BaseModel):
    central: LotResponse
    parents: list[LotResponse]
    children: list[LotResponse]
```

### Current Frontend State (Files to Migrate)

```yaml
# Files to update/deprecate
current_auth_store:
  path: flow-viz-react/src/stores/useAuthStore.ts
  issues:
    - Mixed Supabase OTP and direct fetch
    - No JWT token storage
    - Inconsistent error handling
  action: Migrate to new API client

current_db_adapter:
  path: flow-viz-react/src/lib/db.ts
  issues:
    - Three adapter classes (Supabase, Postgres, Mock)
    - No caching layer
    - Duplicate error handling
  action: Deprecate, replace with TanStack Query hooks

current_supabase:
  path: flow-viz-react/src/lib/supabase.ts
  issues:
    - Only used in mock mode check
    - Supabase client often null
  action: Deprecate

vite_config:
  path: flow-viz-react/vite.config.ts
  issues:
    - Proxy targets port 3000 (Node legacy)
  action: Update to port 8000 (FastAPI)

main_entry:
  path: flow-viz-react/src/main.tsx
  issues:
    - No QueryClientProvider
  action: Add TanStack Query setup
```

### TanStack Query v5 Patterns

**Documentation URLs (research required):**
- https://tanstack.com/query/v5/docs/framework/react/guides/queries
- https://tanstack.com/query/v5/docs/framework/react/guides/mutations
- https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation
- https://tanstack.com/query/v5/docs/framework/react/guides/query-keys
- https://tkdodo.eu/blog/effective-react-query-keys (Query Key Factory pattern)

**Query Key Factory Pattern (from TkDodo):**
```typescript
// One factory per feature
export const lotKeys = {
  all: ['lots'] as const,
  lists: () => [...lotKeys.all, 'list'] as const,
  list: (filters?: LotFilters) => [...lotKeys.lists(), filters] as const,
  details: () => [...lotKeys.all, 'detail'] as const,
  detail: (id: string) => [...lotKeys.details(), id] as const,
};

export const qcKeys = {
  all: ['qc-decisions'] as const,
  lists: () => [...qcKeys.all, 'list'] as const,
  byLot: (lotId: string) => [...qcKeys.lists(), { lotId }] as const,
};

export const traceabilityKeys = {
  all: ['traceability'] as const,
  lot: (lotCode: string) => [...traceabilityKeys.all, lotCode] as const,
};
```

**Mutation with Invalidation:**
```typescript
export function useCreateLot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.lots.create,
    onSuccess: () => {
      // Invalidate all lot lists
      queryClient.invalidateQueries({ queryKey: lotKeys.lists() });
    },
  });
}
```

**v5 Key Changes:**
- `isLoading` → `isPending` (more accurate naming)
- `cacheTime` → `gcTime` (garbage collection time)
- `useQuery` requires object syntax: `useQuery({ queryKey, queryFn })`

### JWT In-Memory Storage Pattern

**Security Reference:**
- https://github.com/marmelab/ra-in-memory-jwt (React admin in-memory JWT)
- https://hasura.io/blog/best-practices-of-using-jwt-with-graphql/ (Hasura JWT guide)

**Pattern:**
```typescript
// Token stored in module closure - not accessible via XSS
let authToken: string | null = null;

export const tokenManager = {
  getToken: () => authToken,
  setToken: (token: string | null) => { authToken = token; },
  clearToken: () => { authToken = null; },
};

// Fetch wrapper injects token
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = tokenManager.getToken();
  const headers = new Headers(options?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  const response = await fetch(path, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiClientError(response.status, error.detail || 'Request failed');
  }

  return response.json();
}
```

### Existing TypeScript Types (Reuse where possible)

```typescript
// flow-viz-react/src/types/database.types.ts
// Already defines Row/Insert/Update patterns for all tables
// Key types to align with:

type UserRole = 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER';
type LotType = 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG';
type QCDecisionType = 'PASS' | 'HOLD' | 'FAIL';
```

---

## Implementation Blueprint

### File Structure (Target)

```
flow-viz-react/src/
├── lib/
│   ├── api/
│   │   ├── client.ts       # Base fetch wrapper + token manager
│   │   ├── types.ts        # TypeScript interfaces for API entities
│   │   ├── auth.ts         # login() function
│   │   ├── lots.ts         # createLot(), getLots() functions
│   │   ├── qc.ts           # createQCDecision() function
│   │   ├── traceability.ts # getTraceability() function
│   │   └── index.ts        # Barrel export
│   ├── db.ts               # DEPRECATED - keep for reference
│   └── supabase.ts         # DEPRECATED - keep for reference
├── hooks/
│   ├── useAuth.ts          # Login/logout with TanStack mutation
│   ├── useLots.ts          # useCreateLot mutation
│   ├── useQC.ts            # useCreateQCDecision mutation
│   └── useTraceability.ts  # useTraceability query
├── stores/
│   └── useAuthStore.ts     # UPDATED - minimal UI state only
└── main.tsx                # UPDATED - add QueryClientProvider
```

### Implementation Tasks (Ordered)

```yaml
Task 1 - Environment + Vite Proxy Setup:
  files:
    - flow-viz-react/.env.development (CREATE)
    - flow-viz-react/.env.production (CREATE)
    - flow-viz-react/vite.config.ts (UPDATE)
    - flow-viz-react/src/vite-env.d.ts (UPDATE)
  validation: |
    curl http://localhost:5173/api/health
    # Expected: {"status":"ok","timestamp":"..."}

Task 2 - API Client Layer:
  files:
    - flow-viz-react/src/lib/api/client.ts (CREATE)
    - flow-viz-react/src/lib/api/types.ts (CREATE)
  validation: |
    # TypeScript compiles
    cd flow-viz-react && npx tsc --noEmit

Task 3 - API Function Modules:
  files:
    - flow-viz-react/src/lib/api/auth.ts (CREATE)
    - flow-viz-react/src/lib/api/lots.ts (CREATE)
    - flow-viz-react/src/lib/api/qc.ts (CREATE)
    - flow-viz-react/src/lib/api/traceability.ts (CREATE)
    - flow-viz-react/src/lib/api/index.ts (CREATE)
  validation: |
    cd flow-viz-react && npx tsc --noEmit

Task 4 - TanStack Query Setup:
  files:
    - flow-viz-react/src/main.tsx (UPDATE)
    - flow-viz-react/src/lib/queryClient.ts (CREATE)
  validation: |
    cd flow-viz-react && npm run build
    # No TypeScript errors

Task 5 - Query Hooks:
  files:
    - flow-viz-react/src/hooks/useLots.ts (CREATE)
    - flow-viz-react/src/hooks/useQC.ts (CREATE)
    - flow-viz-react/src/hooks/useTraceability.ts (CREATE)
    - flow-viz-react/src/hooks/index.ts (CREATE)
  validation: |
    cd flow-viz-react && npx tsc --noEmit

Task 6 - Auth Store Migration:
  files:
    - flow-viz-react/src/stores/useAuthStore.ts (UPDATE)
    - flow-viz-react/src/hooks/useAuth.ts (CREATE)
  validation: |
    cd flow-viz-react && npm run build
    # Manual: Login flow works, token in memory

Task 7 - Component Integration:
  files:
    - flow-viz-react/src/stores/useProductionStore.ts (UPDATE)
    - flow-viz-react/src/lib/db.ts (DEPRECATE - add comment)
    - flow-viz-react/src/lib/supabase.ts (DEPRECATE - add comment)
  validation: |
    cd flow-viz-react && npm run build
    cd flow-viz-react && npm run lint
    # Manual: Full E2E test (login, create lot, QC decision, traceability)

Task 8 - React Query Devtools (Dev Only):
  files:
    - flow-viz-react/package.json (UPDATE - add @tanstack/react-query-devtools)
    - flow-viz-react/src/main.tsx (UPDATE - add devtools)
  validation: |
    cd flow-viz-react && npm install
    cd flow-viz-react && npm run dev
    # React Query Devtools visible in bottom-left
```

---

## Code Snippets (Implementation Reference)

### Task 1: Environment Files

**.env.development:**
```bash
# Development uses Vite proxy - no explicit API URL needed
# VITE_API_URL is intentionally empty in dev
VITE_API_URL=
VITE_DB_MODE=postgres
```

**.env.production:**
```bash
# Production requires explicit API URL
VITE_API_URL=https://api.flowviz.example.com
VITE_DB_MODE=postgres
```

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // FastAPI backend
        changeOrigin: true,
        secure: false,
        // WebSocket support for future features
        ws: true,
      }
    }
  }
})
```

**vite-env.d.ts:**
```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DB_MODE: 'mock' | 'postgres' | 'supabase'
  readonly VITE_USE_MOCK: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### Task 2: API Client

**src/lib/api/client.ts:**
```typescript
/**
 * API Client with JWT token management
 *
 * Token is stored in memory (module closure) for XSS protection.
 * Never stored in localStorage or sessionStorage.
 */

// Token stored in closure - not accessible via XSS
let authToken: string | null = null;

export const tokenManager = {
  getToken: () => authToken,
  setToken: (token: string | null) => { authToken = token; },
  clearToken: () => { authToken = null; },
  hasToken: () => authToken !== null,
};

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public body?: unknown
  ) {
    super(detail);
    this.name = 'ApiClientError';
  }
}

/**
 * Get base URL for API requests
 * In development: empty (uses Vite proxy)
 * In production: explicit VITE_API_URL
 */
function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Type-safe fetch wrapper with automatic JWT injection
 */
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

    throw new ApiClientError(response.status, detail, body);
  }

  // Return parsed JSON (or empty object for 204)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
```

**src/lib/api/types.ts:**
```typescript
/**
 * TypeScript interfaces matching FastAPI Pydantic schemas
 *
 * Reference: backend/app/schemas/
 */

// ============ Enums ============

export type UserRole = 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER';
export type LotType = 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG';
export type QCDecision = 'PASS' | 'HOLD' | 'FAIL';

// ============ User/Auth ============

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_login: string | null;
}

export interface LoginRequest {
  email: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// ============ Lots ============

export interface LotCreate {
  lot_code: string;
  lot_type?: LotType | null;
  production_run_id?: string | null;
  phase_id?: string | null;
  operator_id?: string | null;
  weight_kg?: number | null;
  temperature_c?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface Lot {
  id: string;
  lot_code: string;
  lot_type: LotType | null;
  production_run_id: string | null;
  phase_id: string | null;
  operator_id: string | null;
  weight_kg: number | null;
  temperature_c: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============ QC Decisions ============

export interface QCDecisionCreate {
  lot_id?: string | null;
  qc_gate_id?: string | null;
  operator_id?: string | null;
  decision?: QCDecision | null;
  notes?: string | null;
  temperature_c?: number | null;
  digital_signature?: string | null;
}

export interface QCDecisionResponse {
  id: string;
  lot_id: string | null;
  qc_gate_id: string | null;
  operator_id: string | null;
  decision: QCDecision | null;
  notes: string | null;
  temperature_c: number | null;
  digital_signature: string | null;
  decided_at: string;
}

// ============ Traceability ============

export interface TraceabilityResponse {
  central: Lot;
  parents: Lot[];
  children: Lot[];
}

// ============ Health ============

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}
```

### Task 3: API Function Modules

**src/lib/api/auth.ts:**
```typescript
import { apiFetch, tokenManager } from './client';
import type { LoginRequest, LoginResponse } from './types';

/**
 * Login with email (passwordless for demo)
 * Stores JWT token in memory on success
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
    skipAuth: true, // Login doesn't need auth
  });

  // Store token in memory
  tokenManager.setToken(response.token);

  return response;
}

/**
 * Logout - clears token from memory
 */
export function logout(): void {
  tokenManager.clearToken();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return tokenManager.hasToken();
}
```

**src/lib/api/lots.ts:**
```typescript
import { apiFetch } from './client';
import type { Lot, LotCreate } from './types';

/**
 * Create a new lot
 */
export async function createLot(data: LotCreate): Promise<Lot> {
  return apiFetch<Lot>('/api/lots', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get all lots (future endpoint - placeholder)
 * Note: Backend doesn't have GET /api/lots yet
 */
export async function getLots(): Promise<Lot[]> {
  // TODO: Implement when backend adds GET /api/lots
  console.warn('getLots() not yet implemented - backend needs GET /api/lots');
  return [];
}
```

**src/lib/api/qc.ts:**
```typescript
import { apiFetch } from './client';
import type { QCDecisionCreate, QCDecisionResponse } from './types';

/**
 * Create a QC decision
 * Note: HOLD/FAIL decisions require notes (min 10 chars)
 */
export async function createQCDecision(data: QCDecisionCreate): Promise<QCDecisionResponse> {
  return apiFetch<QCDecisionResponse>('/api/qc-decisions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

**src/lib/api/traceability.ts:**
```typescript
import { apiFetch } from './client';
import type { TraceabilityResponse } from './types';

/**
 * Get traceability graph for a lot
 * Returns central lot with parents and children
 */
export async function getTraceability(lotCode: string): Promise<TraceabilityResponse> {
  return apiFetch<TraceabilityResponse>(`/api/traceability/${encodeURIComponent(lotCode)}`);
}
```

**src/lib/api/index.ts:**
```typescript
// Re-export all API functions
export * from './client';
export * from './types';
export * as auth from './auth';
export * as lots from './lots';
export * as qc from './qc';
export * as traceability from './traceability';

// Convenience namespace
export const api = {
  auth: require('./auth'),
  lots: require('./lots'),
  qc: require('./qc'),
  traceability: require('./traceability'),
} as const;
```

### Task 4: TanStack Query Setup

**src/lib/queryClient.ts:**
```typescript
import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api/client';

/**
 * Query client with sensible defaults
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus in dev
      refetchOnWindowFocus: import.meta.env.PROD,
      // Retry once on failure
      retry: 1,
      // Consider data stale after 30 seconds
      staleTime: 30 * 1000,
      // Keep unused data for 5 minutes
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      // Don't retry mutations
      retry: false,
      // Handle errors globally
      onError: (error) => {
        if (error instanceof ApiClientError) {
          console.error(`API Error [${error.status}]: ${error.detail}`);
        }
      },
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

**src/main.tsx (updated):**
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { router } from './router';
import { queryClient } from './lib/queryClient';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
);
```

### Task 5: Query Hooks

**src/hooks/useLots.ts:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLot } from '../lib/api/lots';
import { queryKeys } from '../lib/queryClient';
import type { LotCreate, Lot } from '../lib/api/types';

/**
 * Mutation hook for creating lots
 * Automatically invalidates lot lists on success
 */
export function useCreateLot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LotCreate) => createLot(data),
    onSuccess: () => {
      // Invalidate all lot queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
    },
  });
}

// Type export for consumers
export type { LotCreate, Lot };
```

**src/hooks/useQC.ts:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createQCDecision } from '../lib/api/qc';
import { queryKeys } from '../lib/queryClient';
import type { QCDecisionCreate, QCDecisionResponse } from '../lib/api/types';

/**
 * Mutation hook for creating QC decisions
 * Invalidates QC queries and related lot queries on success
 */
export function useCreateQCDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: QCDecisionCreate) => createQCDecision(data),
    onSuccess: (_, variables) => {
      // Invalidate QC queries
      queryClient.invalidateQueries({ queryKey: queryKeys.qc.all });

      // Invalidate traceability for the related lot
      if (variables.lot_id) {
        // Would need lot_code here - might need to refetch
        queryClient.invalidateQueries({ queryKey: queryKeys.traceability.all });
      }
    },
  });
}

// Type export for consumers
export type { QCDecisionCreate, QCDecisionResponse };
```

**src/hooks/useTraceability.ts:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { getTraceability } from '../lib/api/traceability';
import { queryKeys } from '../lib/queryClient';
import type { TraceabilityResponse } from '../lib/api/types';

/**
 * Query hook for lot traceability
 * @param lotCode - The lot code to fetch traceability for
 * @param enabled - Whether to enable the query (default: true when lotCode provided)
 */
export function useTraceability(lotCode: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.traceability.lot(lotCode || ''),
    queryFn: () => getTraceability(lotCode!),
    enabled: enabled && !!lotCode,
  });
}

// Type export for consumers
export type { TraceabilityResponse };
```

**src/hooks/index.ts:**
```typescript
export { useCreateLot } from './useLots';
export { useCreateQCDecision } from './useQC';
export { useTraceability } from './useTraceability';
```

### Task 6: Auth Store Migration

**src/stores/useAuthStore.ts (updated):**
```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import * as authApi from '../lib/api/auth';
import { tokenManager } from '../lib/api/client';
import type { User, UserRole } from '../lib/api/types';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      role: null,
      isLoading: false,
      error: null,

      login: async (email: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login({ email });
          set({
            user: response.user,
            role: response.user.role,
            isLoading: false,
            error: null,
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Login failed';
          set({ error: message, isLoading: false });
        }
      },

      logout: () => {
        authApi.logout();
        set({ user: null, role: null, error: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'AuthStore' }
  )
);
```

---

## Validation Gates

### Level 1: Environment + Build Validation

```bash
# Navigate to frontend
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/flow-viz-react

# Check files exist
test -f .env.development && echo "✓ .env.development exists"
test -f .env.production && echo "✓ .env.production exists"
test -f src/lib/api/client.ts && echo "✓ API client exists"
test -f src/lib/api/types.ts && echo "✓ API types exist"
test -f src/hooks/useLots.ts && echo "✓ useLots hook exists"

# TypeScript compilation
npx tsc --noEmit && echo "✓ TypeScript compiles"

# ESLint
npm run lint && echo "✓ ESLint passes"

# Build
npm run build && echo "✓ Production build succeeds"
```

### Level 2: Proxy Validation

```bash
# Start backend (in separate terminal)
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/backend
docker-compose -f docker/docker-compose.yml up -d
uv run uvicorn app.main:app --reload --port 8000 &

# Start frontend (in separate terminal)
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/flow-viz-react
npm run dev &

# Wait for servers to start
sleep 5

# Test proxy
curl -s http://localhost:5173/api/health | grep -q '"status":"ok"' && echo "✓ Proxy works"

# Expected output: {"status":"ok","timestamp":"2025-..."}
```

### Level 3: API Client Validation

```bash
# Run TypeScript in isolation
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/flow-viz-react

# Check API client exports
npx tsx -e "
import { apiFetch, tokenManager, ApiClientError } from './src/lib/api/client';
console.log('✓ client.ts exports work');
console.log('  - apiFetch:', typeof apiFetch);
console.log('  - tokenManager:', typeof tokenManager);
console.log('  - ApiClientError:', typeof ApiClientError);
"

# Check types
npx tsx -e "
import type { User, Lot, LoginResponse, TraceabilityResponse } from './src/lib/api/types';
console.log('✓ types.ts exports work');
"
```

### Level 4: E2E Manual Testing Checklist

```markdown
## Manual E2E Test Checklist

### Auth Flow
- [ ] Navigate to http://localhost:5173
- [ ] Redirected to /login
- [ ] Enter valid email (e.g., admin@example.com)
- [ ] Click login
- [ ] Redirected to /dashboard
- [ ] Check browser console: NO localStorage.setItem calls
- [ ] Check Network tab: POST /api/login returns { user, token }
- [ ] Refresh page: Should be logged out (token in memory only)

### Lot Creation
- [ ] Navigate to /command (requires OPERATOR/MANAGER/ADMIN role)
- [ ] Create new lot with form
- [ ] Check Network tab: POST /api/lots with Authorization header
- [ ] Response includes created lot with ID
- [ ] React Query Devtools: lots cache updated

### QC Decision
- [ ] Navigate to /command
- [ ] Make QC decision (PASS)
- [ ] Check Network tab: POST /api/qc-decisions
- [ ] Make QC decision (HOLD without notes) - should fail validation
- [ ] Make QC decision (HOLD with 10+ char notes) - should succeed

### Traceability
- [ ] Navigate to /validator
- [ ] Search for lot by code
- [ ] Check Network tab: GET /api/traceability/{lot_code}
- [ ] Response shows central lot with parents/children
- [ ] React Query Devtools: traceability cache populated

### Error Handling
- [ ] Stop backend server
- [ ] Try to create lot
- [ ] Check: Error message displayed (not generic "Failed to fetch")
- [ ] Check: No unhandled promise rejections in console
```

---

## Anti-Patterns to Avoid

### API Client
- ❌ Don't store JWT in localStorage (XSS vulnerable)
- ❌ Don't hardcode API URLs (use env variables)
- ❌ Don't swallow errors silently (always throw or handle explicitly)
- ❌ Don't mix sync and async patterns inconsistently

### TanStack Query
- ❌ Don't put server data in Zustand (use Query cache)
- ❌ Don't forget to invalidate queries after mutations
- ❌ Don't use string query keys (use factory functions)
- ❌ Don't ignore `isPending` state (renamed from `isLoading` in v5)

### TypeScript
- ❌ Don't use `any` for API responses (define proper types)
- ❌ Don't duplicate types between frontend and backend (derive from backend schemas)
- ❌ Don't ignore type errors (fix them or add explicit handling)

---

## Dependencies to Add

```bash
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/flow-viz-react

# TanStack Query Devtools (dev only)
npm install -D @tanstack/react-query-devtools
```

Note: `@tanstack/react-query` is already in package.json.

---

## Rollback Strategy

If integration fails:
1. Revert vite.config.ts proxy to port 3000
2. Remove new files in `src/lib/api/` and `src/hooks/`
3. Restore `useAuthStore.ts` from git
4. Remove QueryClientProvider from main.tsx
5. The deprecated `db.ts` and `supabase.ts` remain functional as fallback

---

## References

### Official Documentation
- [TanStack Query v5 Docs](https://tanstack.com/query/v5/docs/framework/react/overview)
- [TanStack Query Key Factories](https://tkdodo.eu/blog/effective-react-query-keys)
- [Vite Proxy Configuration](https://vitejs.dev/config/server-options.html#server-proxy)

### Security Resources
- [JWT in Memory Pattern](https://github.com/marmelab/ra-in-memory-jwt)
- [Hasura JWT Best Practices](https://hasura.io/blog/best-practices-of-using-jwt-with-graphql/)

### Project Files (Existing)
- `backend/app/api/routes/*.py` — FastAPI endpoint definitions
- `backend/app/schemas/*.py` — Pydantic schemas (source of truth for types)
- `flow-viz-react/src/types/database.types.ts` — Existing TypeScript types
- `flow-viz-react/src/stores/useAuthStore.ts` — Current auth implementation

---

## Confidence Score: 9/10

**Strengths:**
- Clear API contract from existing FastAPI backend
- Well-documented TanStack Query patterns
- Existing TypeScript types to build upon
- Minimal backend changes required (none)

**Risks:**
- No GET /api/lots endpoint yet (only POST) — hooks will need placeholder
- Refresh token strategy not specified — single-session only for now
- Component integration may surface additional edge cases

**Mitigation:**
- Task 7 (Component Integration) includes manual E2E testing
- Rollback strategy defined for safe revert
- Incremental migration preserves working state between tasks
