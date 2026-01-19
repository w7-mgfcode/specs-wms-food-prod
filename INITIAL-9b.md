# Scale & Intelligence: Type-Safe API & Future Phases

> **Phase:** 5.2 & 6 - Type-Safe API + Future Roadmap  
> **Sprint:** Week 15-22+ (Q2-Q4 2026)  
> **Priority:** HIGH (Post-production enhancement)  
> **Date:** January 19, 2026  
> **Version:** 1.0  
> **Prerequisite:** INITIAL-9a.md (Offline-First Architecture)

---

## FEATURE:

Eliminate frontend/backend type drift and prepare for future enterprise capabilities:

**Phase 5.2 (Weeks 15-18):**
1. **Type-Safe API Client:** Auto-generate TypeScript client from FastAPI OpenAPI spec using Orval, eliminating manual type maintenance

**Phase 6 (Q3-Q4 2026 - Conditional):**
2. **Multi-Site Support:** Multiple factory locations with centralized reporting
3. **FDA 21 CFR Part 11:** Tamper-evident audit logs, electronic signatures
4. **IoT Integration:** Factory floor sensors (temperature, weight scales)

**Success Criteria:**
- Zero manual TypeScript types, 100% generated from OpenAPI
- CI/CD automatic client regeneration on schema changes
- Phase 6 features ready for conditional activation

---

## TOOLS:

### Type-Safe API
- **Orval**: OpenAPI TypeScript client generator with React Query hooks
- **@tanstack/react-query**: Server state management
- **openapi.json endpoint**: FastAPI auto-generated specification

### Phase 6 (Conditional)
- **PostgreSQL Row-Level Security (RLS)**: Multi-tenant data isolation
- **Cryptographic Signing (ed25519)**: FDA-compliant audit logs
- **MQTT / Modbus / OPC-UA**: Industrial IoT protocols

---

## DEPENDENCIES:

```json
{
  "devDependencies": {
    "orval": "^6.30.0"
  }
}
```

```toml
# backend/pyproject.toml (Phase 6)
[project.dependencies]
cryptography = "^42.0"
paho-mqtt = "^2.0"
pymodbus = "^3.6"
```

---

## SYSTEM PROMPT(S):

```
You are implementing type-safe API client generation.

**OpenAPI Schema Quality:**
- Every endpoint must have complete request/response schemas
- Use Pydantic models for all request bodies
- Version the API (/api/v1/) for stability

**Orval Configuration:**
- Generate React Query hooks (useQuery, useMutation)
- Use axios instance with auth interceptor
- Enable Zod schema generation for runtime validation

**CI Pipeline:**
- Regenerate client on every backend PR
- Fail build if generated types have breaking changes
- Auto-commit generated code to frontend repo
```

---

## IMPLEMENTATION:

### Orval Configuration

```typescript
// flow-viz-react/orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
  flowviz: {
    input: {
      target: 'http://localhost:8000/openapi.json',
    },
    output: {
      target: './src/lib/api/generated/index.ts',
      schemas: './src/lib/api/generated/schemas',
      client: 'react-query',
      mode: 'tags-split',
      override: {
        mutator: {
          path: './src/lib/api/client.ts',
          name: 'customClient',
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
```

### Custom API Client with Auth

```typescript
// flow-viz-react/src/lib/api/client.ts
import Axios, { AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../stores/useAuthStore';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const customClient = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({ ...config, cancelToken: source.token })
    .then(({ data }) => data);
  // @ts-ignore
  promise.cancel = () => source.cancel('Query cancelled');
  return promise;
};
```

### CI Pipeline for Client Generation

```yaml
# .github/workflows/frontend-codegen.yml
name: Frontend API Client Generation

on:
  push:
    branches: [main, develop]
    paths:
      - 'backend/app/schemas/**'
      - 'backend/app/api/routes/**'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      
      - name: Start FastAPI server
        run: |
          cd backend && pip install -e ".[dev]"
          uvicorn app.main:app --port 8000 &
          sleep 10
      
      - name: Generate API client
        run: cd flow-viz-react && npm ci && npm run codegen
      
      - name: Commit generated code
        run: |
          git config user.name "GitHub Actions"
          git add flow-viz-react/src/lib/api/generated/
          git diff --staged --quiet || git commit -m "chore: regenerate API client"
          git push
```

### Generated Code Usage

```typescript
// flow-viz-react/src/pages/LotsPage.tsx
import { useGetApiV1Lots, usePostApiV1Lots } from '../lib/api/generated/lots';
import { LotCreate } from '../lib/api/generated/schemas';

export const LotsPage = () => {
  const { data: lots, isLoading } = useGetApiV1Lots({ limit: 50 });
  const createLotMutation = usePostApiV1Lots();
  
  const handleCreateLot = (data: LotCreate) => {
    createLotMutation.mutate({ data }, {
      onSuccess: (newLot) => console.log('Created:', newLot.lot_code),
    });
  };
  
  if (isLoading) return <LoadingSpinner />;
  return <LotTable lots={lots ?? []} onCreate={handleCreateLot} />;
};
```

---

### Phase 6: Future Enhancements (Conditional)

**Multi-Site Architecture:**
```python
# backend/app/models/site.py
class Site(Base):
    __tablename__ = "sites"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    location = Column(String)
    timezone = Column(String, default="UTC")

# PostgreSQL RLS
"""
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_isolation ON lots
    FOR ALL USING (site_id = current_setting('app.current_site_id')::uuid);
"""
```

**FDA 21 CFR Part 11 Compliance:**
```python
# backend/app/services/audit.py
from nacl.signing import SigningKey
import hashlib, json

class TamperEvidentAuditLog:
    def __init__(self, private_key_hex: str):
        self.signing_key = SigningKey(bytes.fromhex(private_key_hex))
    
    def create_entry(self, action: str, user_id: str, data: dict, previous_hash: str = None) -> dict:
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "user_id": user_id,
            "data": data,
            "previous_hash": previous_hash or "genesis",
        }
        entry_hash = hashlib.sha256(json.dumps(entry, sort_keys=True).encode()).hexdigest()
        signature = self.signing_key.sign(entry_hash.encode()).signature.hex()
        return {**entry, "hash": entry_hash, "signature": signature}
```

**IoT Integration:**
```python
# backend/app/services/iot.py
from aiomqtt import Client as MQTTClient
from pymodbus.client import AsyncModbusTcpClient

class IoTIntegration:
    async def connect_mqtt(self, broker: str):
        async with MQTTClient(broker) as client:
            await client.subscribe("factory/+/temperature")
            async for message in client.messages:
                await self.process_reading(message)
    
    async def read_scale_modbus(self, host: str, address: int) -> float:
        async with AsyncModbusTcpClient(host) as client:
            result = await client.read_holding_registers(address, 2)
            return (result.registers[0] << 16 | result.registers[1]) / 100.0
```

---

## TESTING:

```typescript
// flow-viz-react/src/tests/type-safety.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import { useGetApiV1Lots } from '../lib/api/generated/lots';
import { Lot } from '../lib/api/generated/schemas';

describe('Generated API Types', () => {
  it('useGetApiV1Lots returns typed array', () => {
    type QueryResult = ReturnType<typeof useGetApiV1Lots>['data'];
    expectTypeOf<QueryResult>().toMatchTypeOf<Lot[] | undefined>();
  });
  
  it('Lot has required fields', () => {
    expectTypeOf<Lot>().toHaveProperty('id');
    expectTypeOf<Lot>().toHaveProperty('lot_code');
    expectTypeOf<Lot>().toHaveProperty('lot_type');
  });
});
```

---

## EXAMPLES:

- `backend/app/schemas/` - Pydantic models for OpenAPI
- Orval: https://orval.dev/
- React Query: https://tanstack.com/query

---

## DOCUMENTATION:

- OpenAPI Specification: https://swagger.io/specification/
- FDA 21 CFR Part 11: https://www.fda.gov/regulatory-information/search-fda-guidance-documents

---

## OTHER CONSIDERATIONS:

### Action Items (Phase 5.2: Weeks 15-18)

- [ ] Week 15: Configure Orval and generate initial client
- [ ] Week 16: Migrate existing API calls to generated hooks
- [ ] Week 17: Set up CI pipeline for auto-generation
- [ ] Week 18: Remove all manual type definitions

### Phase 6 Triggers (Conditional)

| Feature | Trigger Condition | Effort |
|---------|-------------------|--------|
| Multi-Site | Site #2 planned within 6 months | 6 weeks |
| FDA Compliance | Pharmaceutical manufacturing | 8 weeks |
| IoT Integration | Scale/sensor automation planned | 4 weeks |

### Deliverables (Phase 5.2)

- [ ] `flow-viz-react/orval.config.ts` - Orval configuration
- [ ] `flow-viz-react/src/lib/api/generated/` - Generated client
- [ ] `flow-viz-react/src/lib/api/client.ts` - Custom client
- [ ] `.github/workflows/frontend-codegen.yml` - CI pipeline
- [ ] `docs/api-client-generation.md` - Documentation

### Package.json Scripts

```json
{
  "scripts": {
    "codegen": "orval --config orval.config.ts",
    "codegen:watch": "orval --config orval.config.ts --watch",
    "typecheck": "tsc --noEmit"
  }
}
```

**Effort Estimate:** 25 days (1-2 frontend engineers)

---

**Phase:** 5.2 & 6 - Type-Safe API + Future Roadmap  
**Last Updated:** January 19, 2026  
**Previous Part:** INITIAL-9a.md (Offline-First Architecture)  
**Status:** Post-production enhancement roadmap
