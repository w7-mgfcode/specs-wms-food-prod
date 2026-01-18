# ADR 0002: React 19 + Zustand State Architecture

**Status:** Accepted  
**Date:** 2026-01-18  
**Decision Makers:** Engineering Team

---

## Context

We need a frontend architecture that:
- Handles complex production state (runs, lots, phases, QC gates)
- Supports real-time updates
- Is type-safe with TypeScript
- Has a gentle learning curve
- Performs well with frequent state updates

---

## Decision

We adopt **React 19** with **Zustand** for state management:

```
React 19
├── Functional components with hooks
├── TypeScript strict mode
└── Zustand stores
    ├── useAuthStore      (auth state)
    ├── useProductionStore (production runtime)
    ├── useUIStore        (language, theme)
    └── useToastStore     (notifications)
```

### Why Zustand Over Redux/MobX/Jotai?

| Feature | Zustand | Redux Toolkit | MobX | Jotai |
|---------|---------|---------------|------|-------|
| Boilerplate | Minimal | Moderate | Low | Minimal |
| Learning Curve | Easy | Moderate | Moderate | Easy |
| TypeScript | Excellent | Good | Good | Excellent |
| Bundle Size | ~1KB | ~10KB | ~15KB | ~2KB |
| DevTools | Yes | Yes | Yes | Yes |
| Middleware | Yes | Yes | Yes | Limited |

---

## Implementation

### Store Structure

```typescript
// useProductionStore.ts
interface ProductionState {
  // Configuration
  scenario: ScenarioConfig | null;
  
  // Runtime
  activeRun: ProductionRun | null;
  currentPhase: number;
  lots: Record<string, Lot>;
  qcGates: Record<string, QCGate>;
  
  // Actions
  startRun: () => void;
  advancePhase: () => void;
  registerLot: (lot: Lot) => void;
  recordQCDecision: (decision: QCDecision) => void;
}
```

### Patterns Used

1. **Slices Pattern:** Large stores split into logical slices
2. **Immer Middleware:** Immutable updates with mutable syntax
3. **Devtools Middleware:** Redux DevTools integration
4. **Persist Middleware:** Optional localStorage persistence

---

## Alternatives Considered

### 1. Redux Toolkit

**Pros:**
- Industry standard
- Excellent tooling
- Large ecosystem

**Cons:**
- More boilerplate than Zustand
- Larger bundle size
- Steeper learning curve

### 2. MobX

**Pros:**
- Reactive, automatic tracking
- Less boilerplate than Redux

**Cons:**
- Proxy-based magic less explicit
- Larger bundle size
- Different mental model

### 3. React Context + useReducer

**Pros:**
- Built-in, no dependencies
- Simple for small apps

**Cons:**
- Performance issues with frequent updates
- Requires manual optimization
- No devtools out of box

### 4. Jotai

**Pros:**
- Atomic, bottom-up approach
- Very small bundle

**Cons:**
- Different paradigm (atoms vs stores)
- Less middleware support
- Better for derived state than complex stores

---

## Consequences

### Positive

- **Simplicity:** Minimal API surface, easy to onboard
- **Performance:** No provider wrapping, direct subscriptions
- **TypeScript:** First-class support, excellent inference
- **Flexibility:** Works alongside React Query for server state

### Negative

- **Less Ecosystem:** Fewer third-party extensions than Redux
- **Normalization:** Manual normalization for complex data
- **Debugging:** DevTools less mature than Redux

---

## References

- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)
- [Zustand vs Redux Comparison](https://docs.pmnd.rs/zustand/getting-started/comparison)
