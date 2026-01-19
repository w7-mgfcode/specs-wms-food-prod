# Scale & Intelligence: Offline-First Architecture

> **Phase:** 5.1 - Offline-First PWA  
> **Sprint:** Week 11-14  
> **Priority:** HIGH (Post-production enhancement)  
> **Date:** January 19, 2026  
> **Version:** 1.0  
> **Prerequisites:** INITIAL-8a/b.md (Production Launch Complete)

---

## FEATURE:

Implement offline-first capabilities for factory floor operation during network outages:

1. **Service Workers:** Cache critical app shell and API responses using Workbox strategies (NetworkFirst, CacheFirst, StaleWhileRevalidate)

2. **IndexedDB Storage:** Store pending lot registrations and QC decisions locally with Dexie.js

3. **Background Sync:** Automatic synchronization when network connectivity returns with retry logic

**Success Criteria:**
- Complete lot registration workflow without network for 24 hours
- All pending data synchronized within 30 seconds of network restoration
- Visual sync status indicator for operator awareness

---

## TOOLS:

- **Workbox (workbox-precaching, workbox-routing, workbox-strategies)**: Google's Service Worker toolkit with caching strategies

- **BackgroundSyncPlugin**: Queue failed network requests and retry when connectivity returns

- **Dexie.js**: TypeScript-first IndexedDB wrapper with promise-based API

- **navigator.onLine / 'online' event**: Browser API for detecting network changes

---

## DEPENDENCIES:

```json
{
  "dependencies": {
    "dexie": "^4.0.0",
    "dexie-react-hooks": "^1.1.7",
    "workbox-window": "^7.0.0"
  },
  "devDependencies": {
    "vite-plugin-pwa": "^0.19.0",
    "workbox-webpack-plugin": "^7.0.0"
  }
}
```

---

## SYSTEM PROMPT(S):

```
You are implementing offline-first capabilities for a factory floor application.

**Service Worker Strategy:**
- NetworkFirst for API calls (try network, fall back to cache)
- CacheFirst for static assets (faster loads)
- Precache critical app shell for instant offline startup

**IndexedDB Design:**
- Store pending operations with unique IDs (crypto.randomUUID)
- Track sync status (synced: true/false) for each record
- Include retry_count for exponential backoff

**Sync Strategy:**
- Attempt sync every 30 seconds when online
- Listen for 'online' event for immediate sync
- Show pending count in UI for operator awareness

**Conflict Resolution:**
- Last-write-wins for simple updates
- Server wins for lot registration (authoritative IDs)
- Never silently discard user data
```

---

## IMPLEMENTATION:

### Service Worker Configuration

```typescript
// flow-viz-react/public/service-worker.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Background sync for offline lot registrations
const lotSyncPlugin = new BackgroundSyncPlugin('lot-queue', {
  maxRetentionTime: 24 * 60, // 24 hours
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (!response.ok && response.status >= 500) {
          await queue.unshiftRequest(entry);
          throw new Error(`Sync failed: ${response.status}`);
        }
      } catch (error) {
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// API routes: Network first with offline fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/lots'),
  new NetworkFirst({
    cacheName: 'api-lots-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      lotSyncPlugin,
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
  'POST'
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/lots'),
  new NetworkFirst({ cacheName: 'api-lots-cache', networkTimeoutSeconds: 3 }),
  'GET'
);

// Static assets: Cache first
registerRoute(
  ({ request }) => ['script', 'style', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Images: Stale while revalidate
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  })
);
```

### IndexedDB Schema with Dexie

```typescript
// flow-viz-react/src/lib/db.ts
import Dexie, { Table } from 'dexie';

export interface PendingLot {
  id: string;
  lot_code: string;
  lot_type: 'RAW' | 'WIP' | 'FINISHED';
  weight_kg?: number;
  temperature_c?: number;
  created_at: string;
  synced: boolean;
  server_id?: string;
  retry_count: number;
  last_error?: string;
}

export interface PendingQCDecision {
  id: string;
  lot_id: string;
  lot_code: string;
  gate_id: number;
  decision: 'PASS' | 'HOLD' | 'FAIL';
  notes?: string;
  created_at: string;
  synced: boolean;
  retry_count: number;
}

class FlowVizDB extends Dexie {
  pending_lots!: Table<PendingLot, string>;
  pending_qc_decisions!: Table<PendingQCDecision, string>;
  cached_lots!: Table<any, string>;

  constructor() {
    super('flowviz-offline');
    
    this.version(1).stores({
      pending_lots: 'id, lot_code, synced, created_at',
      pending_qc_decisions: 'id, lot_id, synced, created_at',
      cached_lots: 'id, lot_code, cached_at',
    });
  }
}

export const db = new FlowVizDB();

export async function getPendingCount(): Promise<number> {
  const lots = await db.pending_lots.where('synced').equals(false).count();
  const qc = await db.pending_qc_decisions.where('synced').equals(false).count();
  return lots + qc;
}
```

### React Query Integration with Offline Support

```typescript
// flow-viz-react/src/lib/api/lots.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db, PendingLot } from '../db';
import { apiClient } from './client';

interface LotCreate {
  lot_code: string;
  lot_type: 'RAW' | 'WIP' | 'FINISHED';
  weight_kg?: number;
  temperature_c?: number;
}

export const useCreateLot = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lot: LotCreate) => {
      try {
        const response = await apiClient.post('/api/v1/lots', lot);
        return response.data;
      } catch (error) {
        // Network failed - save to IndexedDB
        const pendingLot: PendingLot = {
          id: crypto.randomUUID(),
          ...lot,
          created_at: new Date().toISOString(),
          synced: false,
          retry_count: 0,
        };
        await db.pending_lots.add(pendingLot);
        return { ...pendingLot, offline: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots'] });
    },
  });
};

export const useLots = (params?: { limit?: number }) => {
  return useQuery({
    queryKey: ['lots', params],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/api/v1/lots', { params });
        // Cache and merge with pending
        const pending = await db.pending_lots.where('synced').equals(false).toArray();
        return [...pending.map(p => ({ ...p, _pending: true })), ...response.data];
      } catch {
        // Offline: return cached + pending
        const cached = await db.cached_lots.toArray();
        const pending = await db.pending_lots.where('synced').equals(false).toArray();
        return [...pending.map(p => ({ ...p, _pending: true })), ...cached];
      }
    },
    staleTime: 30 * 1000,
  });
};
```

### Sync Status Component

```typescript
// flow-viz-react/src/components/SyncStatus.tsx
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getPendingCount } from '../lib/db';
import { CloudOff, Cloud, RefreshCw, Check } from 'lucide-react';

export const SyncStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const pendingCount = useLiveQuery(() => getPendingCount(), []);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm">
        <CloudOff className="w-4 h-4" />
        <span>Offline</span>
        {pendingCount > 0 && <span className="bg-yellow-200 px-2 rounded-full">{pendingCount} pending</span>}
      </div>
    );
  }
  
  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full text-sm">
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>{pendingCount} pending</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm">
      <Cloud className="w-4 h-4" />
      <Check className="w-4 h-4" />
    </div>
  );
};
```

---

## TESTING:

```typescript
// flow-viz-react/src/tests/offline.test.ts
import { render, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { db } from '../lib/db';

const server = setupServer();
beforeAll(() => server.listen());
afterEach(async () => { server.resetHandlers(); await db.pending_lots.clear(); });
afterAll(() => server.close());

test('saves lot to IndexedDB when network fails', async () => {
  server.use(rest.post('/api/v1/lots', (req, res) => res.networkError('Failed')));
  
  render(<LotRegistrationForm />);
  fireEvent.change(screen.getByLabelText('Lot Code'), { target: { value: 'OFFLINE-001' } });
  fireEvent.click(screen.getByText('Register Lot'));
  
  await waitFor(async () => {
    const pending = await db.pending_lots.toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0].synced).toBe(false);
  });
});
```

---

## EXAMPLES:

- `flow-viz-react/src/stores/useAuthStore.ts` - Zustand store pattern
- Workbox: https://developer.chrome.com/docs/workbox
- Dexie.js: https://dexie.org/

---

## DOCUMENTATION:

- Service Workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- PWA Vite Plugin: https://vite-pwa-org.netlify.app/

---

## OTHER CONSIDERATIONS:

### Action Items (Weeks 11-14)

- [ ] Week 11: Set up Vite PWA plugin and Service Worker
- [ ] Week 12: Implement IndexedDB schema with Dexie
- [ ] Week 13: Create offline-aware React Query hooks
- [ ] Week 14: Build SyncStatus component and test offline flows

### Deliverables

- [ ] `flow-viz-react/public/service-worker.ts` - Service Worker
- [ ] `flow-viz-react/src/lib/db.ts` - IndexedDB schema
- [ ] `flow-viz-react/src/lib/api/lots.ts` - Offline-aware hooks
- [ ] `flow-viz-react/src/components/SyncStatus.tsx` - Sync UI
- [ ] `docs/offline-mode.md` - Documentation

**Effort Estimate:** 15 days (1 frontend engineer)

---

**Phase:** 5.1 - Offline-First PWA  
**Last Updated:** January 19, 2026  
**Next Part:** INITIAL-9b.md (Type-Safe API & Future Phases)
