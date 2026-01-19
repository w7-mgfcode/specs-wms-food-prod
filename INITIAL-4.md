# Phase 4 Frontend → FastAPI Integration INITIAL Spec

## Constraints + Examples

### Constraints
- **Stay within current frontend stack**: React 19 + TypeScript 5.7 + Vite 6 + Zustand 5 + TanStack Query 5;
  no new major libraries unless explicitly approved.
- **No backend breaking changes**: frontend integration must work with existing FastAPI endpoints
  (`/api/login`, `/api/lots`, `/api/traceability/{lot_code}`, `/api/qc-decisions`).
- **Auth strategy**: JWT Bearer tokens stored in memory (not localStorage) for XSS protection;
  tokens sent via `Authorization` header.
- **Environment discipline**: only `VITE_*` prefixed variables exposed to client; dev uses Vite
  proxy, prod uses explicit `VITE_API_URL`.
- **Error handling**: TanStack Query functions must throw on HTTP errors (fetch does not throw on
  4xx/5xx); use consistent `ApiClientError` shape.
- **Server state separation**: Zustand holds only UI/auth state; all server-fetched data managed
  by TanStack Query cache.
- **File size discipline**: components under 500 lines, functions under 50 lines.

### Examples (API endpoints to integrate)
- **Auth**
  - `POST /api/login` → `{ user, token }` (JWT)
- **Lots**
  - `GET /api/lots` → `Lot[]`
  - `POST /api/lots` → `Lot`
- **QC Decisions**
  - `POST /api/qc-decisions` → `QCDecision`
- **Traceability**
  - `GET /api/traceability/{lot_code}` → `{ central, parents, children }`
- **Health**
  - `GET /api/health` → `{ status, version, database, cache }`

## Research Options (3–5)

1. **Generated Client (Full SDK)**
   - Use `openapi-generator` or `Orval` to generate complete TypeScript SDK from FastAPI OpenAPI spec.
2. **Handwritten Client (Manual)**
   - Build custom fetch wrapper with Zod validation for runtime type checking.
3. **Hybrid (Types Generated, Client Handwritten)**
   - Generate TypeScript types from OpenAPI using `openapi-typescript`; write thin typed client wrapper.
4. **Direct Fetch with Inline Types**
   - Use raw fetch with inline TypeScript types; no abstraction layer.
5. **Axios-based Client**
   - Use Axios with interceptors for auth injection and error normalization.

## Tradeoffs (Cost / Risk / Time)

| Option | Cost | Risk | Time | Notes |
| --- | --- | --- | --- | --- |
| Generated Client (SDK) | Medium | Medium | Medium | Auto-generated, harder to debug, CI codegen step. |
| Handwritten Client | Low | Low | Medium | Full control, manual type sync with backend. |
| Hybrid (types + client) | Low | Low | Short | Best balance: auto types, simple client. |
| Direct Fetch | Low | Medium | Short | No abstraction, scattered type definitions. |
| Axios-based | Low | Low | Short | Extra dependency, familiar patterns. |

## MVP Decision

### Chosen: Hybrid (Types Generated, Client Handwritten)

- Delivers type safety from FastAPI's OpenAPI schema without runtime overhead.
- Thin client wrapper provides control over fetch behavior, error handling, and auth injection.
- Compatible with existing Zustand + TanStack Query patterns.
- Minimal build pipeline changes (optional codegen step).
- Easy to debug and incrementally adopt.

## Milestones

1. **M0: Environment + Proxy Setup**
   - Create `.env.development` and `.env.production` files.
   - Update `vite.config.ts` proxy target from port 3000 to 8000.
   - Add `VITE_API_URL` type to `vite-env.d.ts`.

2. **M1: API Client Layer**
   - Create `src/lib/api/client.ts` with base fetch wrapper and JWT injection.
   - Create `src/lib/api/types.ts` with TypeScript interfaces matching FastAPI schemas.
   - Create API function modules: `auth.ts`, `lots.ts`, `qc.ts`, `traceability.ts`.
   - Create barrel export `src/lib/api/index.ts`.

3. **M2: TanStack Query Integration**
   - Create query hooks: `useLots.ts`, `useQC.ts`, `useTraceability.ts`.
   - Implement query key factories for consistent cache management.
   - Add mutation hooks with proper `invalidateQueries` in `onSuccess`.

4. **M3: Auth Store Migration**
   - Update `useAuthStore.ts` to use new API client.
   - Store JWT token in memory (not localStorage).
   - Add `QueryClientProvider` to `src/main.tsx`.

5. **M4: Component Integration**
   - Update components to use new query hooks instead of direct Supabase calls.
   - Deprecate/remove `src/lib/supabase.ts` after migration.
   - Add React Query Devtools for development.

6. **M5: Validation + Polish**
   - End-to-end testing of all flows (login, lot creation, QC decisions, traceability).
   - Error boundary setup for query errors.
   - Performance validation (no regressions from Phase 3).

## Validation Checkpoints

- **Proxy verification**: `curl http://localhost:5173/api/health` returns FastAPI response.
- **Auth flow**: login stores token in memory, subsequent requests include `Authorization` header.
- **Query invalidation**: creating a lot automatically refreshes the lots list.
- **Error handling**: API errors surface correctly in UI with proper status codes.
- **Type safety**: no TypeScript errors in `npm run build`.
- **No console errors**: browser devtools clean during normal operation.
- **Role enforcement**: no edit affordances for read-only roles (inherited from Phase 3).
- **Performance**: no frame drops or layout thrash with target data volume.

## Final Spec (Deliverables)

- **Environment Files**:
  - `.env.development` (empty `VITE_API_URL` for proxy mode)
  - `.env.production` (explicit API URL)

- **Vite Configuration**:
  - Updated proxy target: `localhost:8000`
  - WebSocket support enabled for future features

- **API Client Layer** (`src/lib/api/`):
  - `client.ts` — Base fetch wrapper with JWT injection
  - `types.ts` — TypeScript interfaces for all API entities
  - `auth.ts`, `lots.ts`, `qc.ts`, `traceability.ts` — Endpoint functions
  - `index.ts` — Barrel export

- **Query Hooks** (`src/hooks/`):
  - `useLots.ts` — Queries and mutations for lots
  - `useQC.ts` — Queries and mutations for QC decisions
  - `useTraceability.ts` — Query for lot genealogy

- **Store Updates**:
  - `useAuthStore.ts` — Migrated to new API client

- **App Configuration**:
  - `main.tsx` — QueryClientProvider with sensible defaults
  - React Query Devtools (dev only)

- **Documentation**:
  - `docs/refactor/re/phase-4_FRONTAPI.md` — Full integration plan with code samples
