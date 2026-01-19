# Phase 4: React → FastAPI Integration

> **Master Integration Plan**  
> Branch: `phase/4-frontend-fastapi-integration`  
> Status: **IN PROGRESS**  
> Created: 2026-01-19

---

## Table of Contents

1. [Online Research Digest](#1-online-research-digest)
2. [Brainstorm: Integration Approaches](#2-brainstorm-integration-approaches)
3. [Plan: Implementation Details](#3-plan-implementation-details)
4. [Review: Quality Gate Checklist](#4-review-quality-gate-checklist)

---

## 1. Online Research Digest

### 1.1 Vite Environment Variables & Proxy Patterns

**Source:** [Vite Env Variables Guide](https://vite.dev/guide/env-and-mode.html) | [Vite Server Proxy](https://vite.dev/config/server-options.html#server-proxy)

#### Key Best Practices

- **`VITE_*` Prefix Required**: Only variables prefixed with `VITE_` are exposed to client code via `import.meta.env.VITE_*`
- **Security**: Non-prefixed variables (e.g., `DB_PASSWORD`) are NOT exposed to client bundles
- **File Priority**: `.env.[mode].local` > `.env.[mode]` > `.env.local` > `.env`
- **Type Safety**: Augment `ImportMetaEnv` in `vite-env.d.ts` for TypeScript IntelliSense
- **Static Replacement**: Variables are statically replaced at build time (tree-shaking friendly)

#### Proxy Configuration Pattern

```typescript
// vite.config.ts - Dev proxy eliminates CORS issues
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // FastAPI backend
        changeOrigin: true,
        secure: false,
        // Optionally rewrite path:
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

#### Dev vs Prod Behavior

| Mode | `VITE_API_URL` | API Calls |
|------|----------------|-----------|
| **Dev** | Not needed (proxy handles) | `/api/*` → proxy → `localhost:8000/api/*` |
| **Prod** | `https://api.example.com` | Direct HTTPS calls |

---

### 1.2 TanStack Query Error & Invalidation Patterns

**Source:** [TanStack Query Functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions) | [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) | [Invalidations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)

#### Query Function Error Handling

```typescript
// ✅ Query functions MUST throw on errors
const fetchLots = async (): Promise<Lot[]> => {
  const response = await fetch('/api/lots');
  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }
  return response.json();
};
```

> **Critical**: `fetch` does NOT throw on HTTP errors (4xx/5xx). Always check `response.ok` and throw manually.

#### Mutation Invalidation Pattern

```typescript
const mutation = useMutation({
  mutationFn: createLot,
  onSuccess: async () => {
    // Invalidate related queries after mutation succeeds
    await queryClient.invalidateQueries({ queryKey: ['lots'] });
  },
});
```

#### Best Practices Summary

| Practice | Recommendation |
|----------|----------------|
| **Query Keys** | Hierarchical arrays: `['lots']`, `['lots', lotId]`, `['lots', { filter }]` |
| **staleTime** | Set reasonable defaults (e.g., 30s for lists, 5min for static data) |
| **gcTime** | Keep cached data longer than staleTime (e.g., 5min) |
| **Retry** | Default 3 retries for queries, 0 for mutations |
| **Invalidation** | `await invalidateQueries()` in `onSuccess` to block until refetch |

---

### 1.3 FastAPI CORS & Auth Considerations

**Source:** [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/) | [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)

#### CORS Middleware Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,  # Required for cookies/auth headers
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Critical CORS Rule

> **Wildcards + Credentials Don't Mix**: `allow_origins=["*"]` is INVALID when `allow_credentials=True`. You MUST explicitly list origins.

#### Auth Strategy Comparison

| Strategy | Pros | Cons | CORS Impact |
|----------|------|------|-------------|
| **Bearer Token (JWT)** | Stateless, scalable, CSRF-immune | Client stores token (XSS risk) | Sent via `Authorization` header |
| **HTTP-Only Cookie** | XSS-immune, auto-sent | Requires CSRF protection, same-site config | `credentials: 'include'` required |

**Recommendation for this project**: Use **Bearer Token (JWT)** stored in memory/Zustand (not localStorage) for simplicity and XSS protection. Already implemented in FastAPI backend.

---

### 1.4 OpenAPI → TypeScript Client Generation

**Options Researched:**

| Tool | Pros | Cons | Verdict |
|------|------|------|---------|
| **openapi-typescript** | Types only, zero runtime, tree-shakeable | No fetch wrapper | ✅ Good for types |
| **openapi-fetch** | Typed fetch, minimal overhead | Needs openapi-typescript | ✅ Companion to above |
| **Orval** | Full client generation, hooks support | Complex config, opinionated | ⚠️ Overkill |
| **openapi-generator** | Multi-language, mature | Bloated output, complex setup | ❌ Too heavy |

**Recommendation**: Use `openapi-typescript` for types + handwritten thin client. This gives us:
- Full type safety from FastAPI's OpenAPI schema
- Control over fetch behavior (error handling, retries)
- No runtime overhead
- Easier debugging

---

## 2. Brainstorm: Integration Approaches

### Approach A: Generated Client (Full SDK)

Generate a complete TypeScript SDK from FastAPI's OpenAPI spec using `openapi-generator` or `Orval`.

| Aspect | Assessment |
|--------|------------|
| **Type Safety** | ✅ Excellent - auto-generated from schema |
| **DX** | ⚠️ Medium - debugging generated code is harder |
| **Maintenance** | ⚠️ Medium - regenerate on every API change |
| **CI Impact** | ⚠️ Adds codegen step to build |
| **Migration Risk** | ⚠️ Big change, hard to incrementally adopt |

### Approach B: Handwritten Client (Manual)

Build a custom fetch wrapper with Zod validation for runtime type checking.

| Aspect | Assessment |
|--------|------------|
| **Type Safety** | ✅ Good - manual types + Zod runtime validation |
| **DX** | ✅ Excellent - full control, easy debugging |
| **Maintenance** | ⚠️ Manual sync with backend changes |
| **CI Impact** | ✅ None - just regular TS files |
| **Migration Risk** | ✅ Low - incremental adoption possible |

### Approach C: Hybrid (Types Generated, Client Handwritten) ⭐ RECOMMENDED

Generate TypeScript types from OpenAPI, write a thin typed client wrapper.

| Aspect | Assessment |
|--------|------------|
| **Type Safety** | ✅ Excellent - generated types from OpenAPI |
| **DX** | ✅ Excellent - thin wrapper, easy debugging |
| **Maintenance** | ✅ Good - types auto-update, client stays stable |
| **CI Impact** | ⚠️ Optional codegen step (can be on-demand) |
| **Migration Risk** | ✅ Low - compatible with existing patterns |

### Decision: **Approach C (Hybrid)**

**Rationale:**
1. Best balance of type safety and maintainability
2. Compatible with existing Zustand + TanStack Query patterns
3. Minimal changes to build pipeline
4. Easy to understand and debug
5. FastAPI already generates OpenAPI spec at `/openapi.json`

---

## 3. Plan: Implementation Details

### 3.1 File Structure (New/Modified)

```plaintext
flow-viz-react/
├── .env.development          # NEW: Dev environment
├── .env.production           # NEW: Prod environment
├── vite.config.ts            # MODIFIED: Update proxy target
├── src/
│   ├── vite-env.d.ts         # MODIFIED: Add VITE_API_URL type
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts     # NEW: Base API client
│   │   │   ├── types.ts      # NEW: Generated/manual API types
│   │   │   ├── auth.ts       # NEW: Auth API functions
│   │   │   ├── lots.ts       # NEW: Lots API functions
│   │   │   ├── qc.ts         # NEW: QC API functions
│   │   │   ├── traceability.ts # NEW: Traceability API
│   │   │   └── index.ts      # NEW: Export all
│   │   └── supabase.ts       # DEPRECATED (kept for reference)
│   ├── hooks/
│   │   ├── useAuth.ts        # NEW: Auth query hooks
│   │   ├── useLots.ts        # NEW: Lots query hooks
│   │   ├── useQC.ts          # NEW: QC query hooks
│   │   └── useTraceability.ts # NEW: Traceability hooks
│   ├── stores/
│   │   ├── useAuthStore.ts   # MODIFIED: Use new API client
│   │   └── ...               # Others unchanged
│   └── main.tsx              # MODIFIED: Add QueryClientProvider
```

---

### 3.2 Environment Configuration

#### `.env.development`

```bash
# Development environment
VITE_API_URL=
# Empty = use Vite proxy (recommended for dev)
# Set explicitly only if proxy is disabled

VITE_USE_MOCK=false
VITE_DB_MODE=fastapi
```

#### `.env.production`

```bash
# Production environment
VITE_API_URL=https://api.flowviz.example.com
VITE_USE_MOCK=false
VITE_DB_MODE=fastapi
```

#### `src/vite-env.d.ts` Update

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_DB_MODE: 'fastapi' | 'supabase' | 'postgres';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

### 3.3 Vite Proxy Configuration

#### `vite.config.ts` (Updated)

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
        target: 'http://localhost:8000',  // FastAPI (was 3000 for Node)
        changeOrigin: true,
        secure: false,
        // WebSocket support for future real-time features
        ws: true,
      }
    }
  }
})
```

**Rationale**: Proxy eliminates CORS issues in development. In production, `VITE_API_URL` points directly to the API.

---

### 3.4 API Client Implementation

#### `src/lib/api/client.ts`

```typescript
/**
 * Base API client for FastAPI backend.
 * 
 * Features:
 * - Automatic base URL resolution (proxy in dev, VITE_API_URL in prod)
 * - JWT token injection via Authorization header
 * - Consistent error normalization
 * - Request/response type safety
 */

export interface ApiError {
  status: number;
  message: string;
  detail?: unknown;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// Token storage (in-memory for XSS protection)
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Get base URL for API calls.
 * - Dev: Empty (uses Vite proxy)
 * - Prod: VITE_API_URL environment variable
 */
function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Build headers for API request.
 */
function buildHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders);
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  
  return headers;
}

/**
 * Parse error response from FastAPI.
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const data = await response.json();
    return {
      status: response.status,
      message: data.detail || data.message || response.statusText,
      detail: data,
    };
  } catch {
    return {
      status: response.status,
      message: response.statusText,
    };
  }
}

/**
 * Generic fetch wrapper with error handling.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers),
  });
  
  if (!response.ok) {
    const error = await parseErrorResponse(response);
    throw new ApiClientError(error.status, error.message, error.detail);
  }
  
  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }
  
  return response.json() as Promise<T>;
}

/**
 * Typed HTTP methods for convenience.
 */
export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
    
  post: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  put: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  patch: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
```

---

### 3.5 API Types

#### `src/lib/api/types.ts`

```typescript
/**
 * API Types - matching FastAPI Pydantic schemas.
 * 
 * These can be auto-generated from /openapi.json using openapi-typescript.
 * For now, manually maintained for control.
 */

// ============ Auth ============

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER';
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

export type LotType = 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG';

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

export interface LotCreate {
  lot_code: string;
  lot_type?: LotType;
  production_run_id?: string;
  phase_id?: string;
  operator_id?: string;
  weight_kg?: number;
  temperature_c?: number;
  metadata?: Record<string, unknown>;
}

// ============ QC ============

export type QCDecisionType = 'PASS' | 'HOLD' | 'FAIL';

export interface QCDecision {
  id: string;
  lot_id: string;
  qc_gate_id: string | null;
  operator_id: string | null;
  decision: QCDecisionType;
  notes: string | null;
  temperature_c: number | null;
  digital_signature: string | null;
  created_at: string;
}

export interface QCDecisionCreate {
  lot_id: string;
  qc_gate_id?: string;
  operator_id?: string;
  decision: QCDecisionType;
  notes?: string;
  temperature_c?: number;
  digital_signature?: string;
}

// ============ Traceability ============

export interface TraceabilityResponse {
  central: Lot;
  parents: Lot[];
  children: Lot[];
}

// ============ Health ============

export interface HealthResponse {
  status: string;
  version: string;
  database: string;
  cache: string;
}
```

---

### 3.6 API Function Modules

#### `src/lib/api/auth.ts`

```typescript
import { api, setAuthToken } from './client';
import type { LoginRequest, LoginResponse, User } from './types';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/login', credentials);
  // Store token in memory
  setAuthToken(response.token);
  return response;
}

export async function logout(): Promise<void> {
  setAuthToken(null);
  // Optional: Call backend logout endpoint if session tracking needed
}

export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/api/me');
}
```

#### `src/lib/api/lots.ts`

```typescript
import { api } from './client';
import type { Lot, LotCreate } from './types';

export async function getLots(): Promise<Lot[]> {
  return api.get<Lot[]>('/api/lots');
}

export async function getLot(lotId: string): Promise<Lot> {
  return api.get<Lot>(`/api/lots/${lotId}`);
}

export async function createLot(data: LotCreate): Promise<Lot> {
  return api.post<Lot>('/api/lots', data);
}

export async function updateLot(lotId: string, data: Partial<LotCreate>): Promise<Lot> {
  return api.put<Lot>(`/api/lots/${lotId}`, data);
}

export async function deleteLot(lotId: string): Promise<void> {
  return api.delete(`/api/lots/${lotId}`);
}
```

#### `src/lib/api/qc.ts`

```typescript
import { api } from './client';
import type { QCDecision, QCDecisionCreate } from './types';

export async function getQCDecisions(lotId?: string): Promise<QCDecision[]> {
  const params = lotId ? `?lot_id=${lotId}` : '';
  return api.get<QCDecision[]>(`/api/qc-decisions${params}`);
}

export async function createQCDecision(data: QCDecisionCreate): Promise<QCDecision> {
  return api.post<QCDecision>('/api/qc-decisions', data);
}
```

#### `src/lib/api/traceability.ts`

```typescript
import { api } from './client';
import type { TraceabilityResponse } from './types';

export async function getTraceability(lotCode: string): Promise<TraceabilityResponse> {
  return api.get<TraceabilityResponse>(`/api/traceability/${encodeURIComponent(lotCode)}`);
}
```

#### `src/lib/api/index.ts`

```typescript
// Re-export everything for convenient imports
export * from './client';
export * from './types';
export * from './auth';
export * from './lots';
export * from './qc';
export * from './traceability';
```

---

### 3.7 TanStack Query Hooks

#### `src/hooks/useLots.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLots, getLot, createLot, updateLot, deleteLot } from '../lib/api';
import type { Lot, LotCreate } from '../lib/api/types';

// Query Keys - centralized for consistency
export const lotKeys = {
  all: ['lots'] as const,
  lists: () => [...lotKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...lotKeys.lists(), filters] as const,
  details: () => [...lotKeys.all, 'detail'] as const,
  detail: (id: string) => [...lotKeys.details(), id] as const,
};

// ============ Queries ============

export function useLotsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lotKeys.lists(),
    queryFn: getLots,
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

export function useLotQuery(lotId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lotKeys.detail(lotId),
    queryFn: () => getLot(lotId),
    staleTime: 60 * 1000, // 1 minute
    enabled: !!lotId,
    ...options,
  });
}

// ============ Mutations ============

export function useCreateLotMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: LotCreate) => createLot(data),
    onSuccess: async () => {
      // Invalidate list queries to refetch
      await queryClient.invalidateQueries({ queryKey: lotKeys.lists() });
    },
  });
}

export function useUpdateLotMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ lotId, data }: { lotId: string; data: Partial<LotCreate> }) =>
      updateLot(lotId, data),
    onSuccess: async (updatedLot) => {
      // Update cache directly for immediate UI update
      queryClient.setQueryData(lotKeys.detail(updatedLot.id), updatedLot);
      // Also invalidate lists
      await queryClient.invalidateQueries({ queryKey: lotKeys.lists() });
    },
  });
}

export function useDeleteLotMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (lotId: string) => deleteLot(lotId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: lotKeys.all });
    },
  });
}
```

#### `src/hooks/useQC.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQCDecisions, createQCDecision } from '../lib/api';
import type { QCDecisionCreate } from '../lib/api/types';
import { lotKeys } from './useLots';

export const qcKeys = {
  all: ['qc-decisions'] as const,
  byLot: (lotId: string) => [...qcKeys.all, 'lot', lotId] as const,
};

export function useQCDecisionsQuery(lotId?: string) {
  return useQuery({
    queryKey: lotId ? qcKeys.byLot(lotId) : qcKeys.all,
    queryFn: () => getQCDecisions(lotId),
    staleTime: 30 * 1000,
  });
}

export function useCreateQCDecisionMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: QCDecisionCreate) => createQCDecision(data),
    onSuccess: async (decision) => {
      // Invalidate QC decisions
      await queryClient.invalidateQueries({ queryKey: qcKeys.all });
      // Also invalidate the related lot (might affect status)
      if (decision.lot_id) {
        await queryClient.invalidateQueries({ 
          queryKey: lotKeys.detail(decision.lot_id) 
        });
      }
    },
  });
}
```

#### `src/hooks/useTraceability.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { getTraceability } from '../lib/api';

export const traceabilityKeys = {
  all: ['traceability'] as const,
  byLotCode: (lotCode: string) => [...traceabilityKeys.all, lotCode] as const,
};

export function useTraceabilityQuery(lotCode: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: traceabilityKeys.byLotCode(lotCode),
    queryFn: () => getTraceability(lotCode),
    staleTime: 60 * 1000, // 1 minute (genealogy doesn't change often)
    enabled: !!lotCode,
    ...options,
  });
}
```

---

### 3.8 Auth Store Update

#### `src/stores/useAuthStore.ts` (Updated)

```typescript
import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout, setAuthToken, getAuthToken } from '../lib/api';
import type { User } from '../lib/api/types';

type Role = User['role'];

interface AuthState {
  user: User | null;
  role: Role | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  login: async (email: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiLogin({ email });
      set({
        user: response.user,
        role: response.user.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
    }
  },

  logout: async () => {
    await apiLogout();
    set({
      user: null,
      role: null,
      isAuthenticated: false,
      error: null,
    });
  },

  setUser: (user: User | null) => {
    set({
      user,
      role: user?.role ?? null,
      isAuthenticated: !!user,
    });
  },

  clearError: () => set({ error: null }),
}));

// Selector hooks for common patterns
export const useUser = () => useAuthStore((state) => state.user);
export const useRole = () => useAuthStore((state) => state.role);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
```

---

### 3.9 QueryClient Setup

#### `src/main.tsx` (Updated)

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { router } from './router';
import './styles/index.css';

// Create QueryClient with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,      // 30 seconds
      gcTime: 5 * 60 * 1000,     // 5 minutes (was cacheTime in v4)
      retry: 3,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,  // Don't retry mutations by default
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

### 3.10 Endpoint Migration Mapping

| Old Endpoint (Node) | New Endpoint (FastAPI) | Breaking Changes |
|---------------------|------------------------|------------------|
| `POST /api/login` | `POST /api/login` | ✅ Parity (returns `{user, token}`) |
| `GET /api/lots` | `GET /api/lots` | ⚠️ TBD - may need pagination |
| `POST /api/lots` | `POST /api/lots` | ✅ Parity |
| `GET /api/traceability/:code` | `GET /api/traceability/{lot_code}` | ✅ Parity (path param syntax) |
| `POST /api/qc-decisions` | `POST /api/qc-decisions` | ✅ Parity |
| `GET /api/health` | `GET /api/health` | ✅ Parity |

**Note**: FastAPI uses `{param}` syntax for path parameters (OpenAPI spec), but from the client perspective, this is transparent.

---

### 3.11 Step-by-Step Task List

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 1 | Create `.env.development` and `.env.production` | `flow-viz-react/` | P0 |
| 2 | Update `vite.config.ts` proxy target to port 8000 | `vite.config.ts` | P0 |
| 3 | Add `VITE_API_URL` type to `vite-env.d.ts` | `src/vite-env.d.ts` | P0 |
| 4 | Create API client module | `src/lib/api/client.ts` | P0 |
| 5 | Create API types | `src/lib/api/types.ts` | P0 |
| 6 | Create auth API functions | `src/lib/api/auth.ts` | P0 |
| 7 | Create lots API functions | `src/lib/api/lots.ts` | P0 |
| 8 | Create QC API functions | `src/lib/api/qc.ts` | P1 |
| 9 | Create traceability API functions | `src/lib/api/traceability.ts` | P1 |
| 10 | Create barrel export | `src/lib/api/index.ts` | P0 |
| 11 | Create TanStack Query hooks for lots | `src/hooks/useLots.ts` | P1 |
| 12 | Create TanStack Query hooks for QC | `src/hooks/useQC.ts` | P1 |
| 13 | Create TanStack Query hooks for traceability | `src/hooks/useTraceability.ts` | P1 |
| 14 | Update `useAuthStore` to use new API client | `src/stores/useAuthStore.ts` | P0 |
| 15 | Add QueryClientProvider to app | `src/main.tsx` | P0 |
| 16 | Install `@tanstack/react-query-devtools` | `package.json` | P1 |
| 17 | Update components to use new hooks | Various | P2 |
| 18 | Remove/deprecate Supabase client | `src/lib/supabase.ts` | P2 |

---

### 3.12 Commands to Run

```bash
# 1. Install TanStack Query devtools (optional but recommended)
cd flow-viz-react
npm install @tanstack/react-query-devtools

# 2. Start FastAPI backend (in another terminal)
cd backend
docker-compose -f docker/docker-compose.yml up -d
uv run uvicorn app.main:app --reload --port 8000

# 3. Start Vite dev server
cd flow-viz-react
npm run dev

# 4. Test API connection
curl http://localhost:8000/api/health
curl http://localhost:5173/api/health  # Through Vite proxy

# 5. Lint and type-check
npm run lint
npm run build  # Includes tsc

# 6. Run E2E tests (when available)
npx playwright test
```

---

### 3.13 CI/CD Notes

#### Environment Variables for CI

| Variable | GitHub Secret | Description |
|----------|---------------|-------------|
| `VITE_API_URL` | `VITE_API_URL` | Production API URL |
| `DATABASE_URL` | `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET_KEY` | `JWT_SECRET_KEY` | JWT signing key |

#### Docker Compose for Testing

```yaml
# .github/docker-compose.test.yml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: flowviz_test
    ports:
      - "5432:5432"
  
  api:
    build:
      context: ./backend
      dockerfile: docker/Dockerfile
    environment:
      DATABASE_URL: postgresql+asyncpg://test:test@db:5432/flowviz_test
      JWT_SECRET_KEY: test-secret
    depends_on:
      - db
    ports:
      - "8000:8000"
  
  frontend:
    build:
      context: ./flow-viz-react
      dockerfile: Dockerfile
    environment:
      VITE_API_URL: http://api:8000
    depends_on:
      - api
    ports:
      - "80:80"
```

---

## 4. Review: Quality Gate Checklist

### ✅ Pre-Implementation Checklist

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Does dev work without CORS pain? | ⏳ | Vite proxy configured |
| 2 | Are errors surfaced correctly in Query? | ⏳ | `ApiClientError` throws on non-ok |
| 3 | Are queryKeys consistent? | ⏳ | Centralized key factories |
| 4 | Are invalidations correct? | ⏳ | `onSuccess` handlers in mutations |
| 5 | Is auth safe and coherent? | ⏳ | JWT Bearer token in memory |
| 6 | No server-state in Zustand? | ⏳ | Only `user` object (minimal) |
| 7 | Breaking changes documented? | ✅ | See Section 3.10 |

### Post-Implementation Validation

- [ ] `npm run build` succeeds without errors
- [ ] `npm run lint` passes
- [ ] Login flow works end-to-end
- [ ] Lot creation works with proper invalidation
- [ ] QC decision creates and updates UI
- [ ] Traceability graph loads correctly
- [ ] Devtools show proper cache state
- [ ] No console errors in browser

---

## Appendix A: OpenAPI Type Generation (Optional)

For future automation, use `openapi-typescript`:

```bash
# Install
npm install -D openapi-typescript

# Generate types from running FastAPI
npx openapi-typescript http://localhost:8000/openapi.json -o src/lib/api/generated.ts

# Add to package.json scripts
"scripts": {
  "generate:api": "openapi-typescript http://localhost:8000/openapi.json -o src/lib/api/generated.ts"
}
```

---

## Appendix B: CSRF Protection Notes

Since we're using **Bearer tokens** (not cookies), CSRF protection is NOT required:

- Bearer tokens are not automatically sent by browsers
- Tokens are explicitly added via `Authorization` header
- XSS is mitigated by storing token in memory (not localStorage)

If we switch to HTTP-only cookies in the future:
1. Add `SameSite=Strict` or `SameSite=Lax` cookie attribute
2. Implement CSRF token validation on FastAPI
3. Send CSRF token in custom header from frontend

---

## Appendix C: Error Handling Patterns

### Consistent Error Shape

```typescript
// All API errors follow this shape
interface ApiErrorShape {
  status: number;      // HTTP status code
  message: string;     // Human-readable message
  detail?: unknown;    // Original FastAPI error detail
}

// Usage in components
const { error } = useLotsQuery();
if (error instanceof ApiClientError) {
  if (error.status === 401) {
    // Redirect to login
  } else if (error.status === 403) {
    // Show permission denied
  } else {
    // Show generic error with error.message
  }
}
```

### Global Error Boundary (Optional)

```typescript
// src/components/ErrorBoundary.tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

export function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div>
              <h2>Something went wrong</h2>
              <pre>{error.message}</pre>
              <button onClick={resetErrorBoundary}>Try again</button>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

---

_Document Version: 1.0.0_  
_Last Updated: 2026-01-19_  
_Author: AI Integration Architect_
