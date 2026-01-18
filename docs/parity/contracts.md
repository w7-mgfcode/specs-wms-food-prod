# API Parity Contracts

> Response shape contracts for Node/Express to FastAPI migration parity validation.
>
> **Status:** Active | **Version:** 1.0 | **Date:** 2026-01-18

---

## Overview

This document defines explicit response shape contracts for each API endpoint. During the migration from Node/Express to FastAPI, these contracts ensure that:

1. Response shapes remain identical (fields, types, nullable behavior)
2. Error formats are consistent or documented as acceptable deltas
3. Both success (2xx) and failure (4xx/5xx) responses are covered

---

## Endpoint Contracts

### 1. GET /api/health

**Purpose:** Health check endpoint for monitoring and load balancer probes.

#### Success Response (200 OK)

```typescript
interface HealthResponse {
  status: "ok";           // Always "ok" when healthy
  timestamp: string;      // ISO8601 format ending in "Z" (UTC)
}
```

**Example:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-18T12:34:56.789Z"
}
```

#### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 500 | Server error | `{"detail": "Internal server error"}` |

---

### 2. POST /api/login

**Purpose:** User authentication (passwordless demo mode).

#### Request

```typescript
interface LoginRequest {
  email: string;  // Valid email format (EmailStr in Pydantic)
}
```

#### Success Response (200 OK)

```typescript
interface LoginResponse {
  user: UserResponse;
  token: string;         // JWT token (FastAPI) or mock token (Node/Express)
}

interface UserResponse {
  id: string;            // UUID v4 format
  email: string;         // User's email address
  full_name: string | null;  // Display name (nullable)
  role: "ADMIN" | "MANAGER" | "AUDITOR" | "OPERATOR" | "VIEWER";
  created_at: string;    // ISO8601 timestamp
  last_login: string | null;  // ISO8601 timestamp or null
}
```

**Example:**
```json
{
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "email": "operator@flowviz.com",
    "full_name": "Test Operator",
    "role": "OPERATOR",
    "created_at": "2026-01-01T00:00:00Z",
    "last_login": null
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 401 | User not found | `{"detail": "Invalid credentials"}` |
| 422 | Invalid email format | `{"detail": [...validation errors...]}` |

**Acceptable Delta:**
- Node/Express returns `{"error": "User not found"}` with `error` key
- FastAPI returns `{"detail": "Invalid credentials"}` with `detail` key
- Token format differs (mock vs real JWT) but shape is identical

---

### 3. POST /api/lots

**Purpose:** Create a new production lot.

#### Request

```typescript
interface LotCreateRequest {
  lot_code: string;              // Required, 1-100 characters
  lot_type?: "RAW" | "DEB" | "BULK" | "MIX" | "SKW" | "FRZ" | "FG";
  production_run_id?: string;    // UUID v4 (optional)
  weight_kg?: number;            // 0-10000, max 2 decimal places
  temperature_c?: number;        // -50 to 100, max 1 decimal place
  metadata?: object;             // Arbitrary JSON object
}
```

#### Success Response (201 Created)

```typescript
interface LotResponse {
  id: string;                    // UUID v4, auto-generated
  lot_code: string;              // As provided
  lot_type: string | null;       // Enum value or null
  production_run_id: string | null;
  phase_id: string | null;       // Always null on creation
  operator_id: string | null;    // Always null (no auth context in demo)
  weight_kg: number | null;      // Decimal as number
  temperature_c: number | null;  // Decimal as number
  metadata: object;              // JSONB, defaults to {}
  created_at: string;            // ISO8601 timestamp
}
```

**Example:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "lot_code": "RAW-BEEF-001",
  "lot_type": "RAW",
  "production_run_id": null,
  "phase_id": null,
  "operator_id": null,
  "weight_kg": 500.0,
  "temperature_c": 4.0,
  "metadata": {"supplier": "ACME"},
  "created_at": "2026-01-18T12:34:56.789Z"
}
```

#### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 422 | Missing lot_code | `{"detail": [...validation errors...]}` |
| 422 | weight_kg < 0 | `{"detail": [...validation errors...]}` |
| 422 | weight_kg > 10000 | `{"detail": [...validation errors...]}` |
| 422 | temperature_c < -50 | `{"detail": [...validation errors...]}` |
| 422 | temperature_c > 100 | `{"detail": [...validation errors...]}` |
| 422 | Invalid lot_type enum | `{"detail": [...validation errors...]}` |

**Acceptable Delta:**
- Node/Express accepts ANY fields (dynamic SQL INSERT)
- FastAPI validates against schema (rejects unknown fields with 422)

---

### 4. POST /api/qc-decisions

**Purpose:** Record a quality control decision for a lot.

#### Request

```typescript
interface QCDecisionRequest {
  lot_id?: string;               // UUID v4 of the lot (optional)
  qc_gate_id?: string;           // UUID v4 of the QC gate (optional)
  decision?: "PASS" | "HOLD" | "FAIL";
  notes?: string;                // Required for HOLD/FAIL (min 10 chars)
  temperature_c?: number;        // -50 to 100
  digital_signature?: string;    // Optional signature
}
```

**Business Rule (CLAUDE.md):**
- HOLD/FAIL decisions MUST include notes with at least 10 characters
- PASS decisions do not require notes

#### Success Response (201 Created)

```typescript
interface QCDecisionResponse {
  id: string;                    // UUID v4, auto-generated
  lot_id: string | null;
  qc_gate_id: string | null;
  operator_id: string | null;    // Always null (no auth context in demo)
  decision: string | null;       // Enum value or null
  notes: string | null;
  temperature_c: number | null;
  digital_signature: string | null;
  decided_at: string;            // ISO8601 timestamp
}
```

**Example:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "lot_id": null,
  "qc_gate_id": null,
  "operator_id": null,
  "decision": "PASS",
  "notes": "All checks passed",
  "temperature_c": 4.5,
  "digital_signature": null,
  "decided_at": "2026-01-18T12:34:56.789Z"
}
```

#### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 422 | HOLD without notes | `{"detail": [...validation errors...]}` |
| 422 | FAIL without notes | `{"detail": [...validation errors...]}` |
| 422 | HOLD/FAIL with notes < 10 chars | `{"detail": [...validation errors...]}` |
| 422 | Invalid decision enum | `{"detail": [...validation errors...]}` |

---

### 5. GET /api/traceability/{lot_code}

**Purpose:** Retrieve lot genealogy (parent/child relationships).

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `lot_code` | string | The lot code to trace |

#### Success Response (200 OK)

```typescript
interface TraceabilityResponse {
  central: LotResponse;          // The queried lot
  parents: LotResponse[];        // Upstream lots (ingredients/inputs)
  children: LotResponse[];       // Downstream lots (outputs/products)
}
```

**Example:**
```json
{
  "central": {
    "id": "22222222-2222-2222-2222-222222222201",
    "lot_code": "MIX-BATCH-88",
    "lot_type": "MIX",
    "weight_kg": 540.0,
    "temperature_c": null,
    "metadata": {},
    "created_at": "2026-01-18T10:00:00Z",
    "production_run_id": null,
    "phase_id": null,
    "operator_id": null
  },
  "parents": [
    {
      "id": "11111111-1111-1111-1111-111111111101",
      "lot_code": "RAW-BEEF-001",
      "lot_type": "RAW",
      "weight_kg": 500.0,
      ...
    }
  ],
  "children": [
    {
      "id": "33333333-3333-3333-3333-333333333301",
      "lot_code": "FG-DONER-X1",
      "lot_type": "FG",
      "weight_kg": 530.0,
      ...
    }
  ]
}
```

#### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Lot not found | `{"detail": "Lot not found"}` |

**Acceptable Delta:**
- Node/Express returns `{"error": "Lot not found"}` with `error` key
- FastAPI returns `{"detail": "Lot not found"}` with `detail` key

---

## Common Patterns

### Error Response Format (FastAPI Default)

All validation errors follow Pydantic's format:

```typescript
interface ValidationError {
  detail: Array<{
    type: string;       // Error type (e.g., "missing", "value_error")
    loc: string[];      // Location in request (e.g., ["body", "lot_code"])
    msg: string;        // Human-readable message
    input: any;         // The invalid input value
  }>;
}
```

### Nullable Fields

Fields marked as `| null` in TypeScript interfaces may be:
- Explicitly set to `null` in the response
- Omitted from the response (treated as `null` by clients)

FastAPI includes all fields explicitly. Node/Express may omit null fields.

---

## Acceptable Deltas Summary

| Endpoint | Delta | Reason |
|----------|-------|--------|
| `/api/login` | Token format | FastAPI uses real JWT; Node uses mock |
| `/api/login` | Error key | `detail` (FastAPI) vs `error` (Node) |
| `/api/lots` | Unknown fields | FastAPI rejects; Node accepts |
| `/api/traceability` | Error key | `detail` (FastAPI) vs `error` (Node) |

These deltas are documented and approved. Frontend may need minor updates for error handling.

---

## Validation Checklist

- [x] All 5 endpoints documented
- [x] Request schemas defined
- [x] Success response shapes defined
- [x] Error responses enumerated
- [x] Nullable fields marked
- [x] Acceptable deltas documented

---

_Last updated: 2026-01-18 | Phase 2: API Parity Validation_
