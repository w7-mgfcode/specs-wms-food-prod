# Phase 3: First Flow Lane-Based UI PRP

## Purpose

Implement a lane-based flow visualization with step overlay for the Phase 3 "First Flow" feature as specified in `INITIAL-3.md`. This delivers an interactive, configuration-driven production flow UI that renders buffer lanes with lot cards, temperature/weight badges, and a QC gate stepper overlay.

## Core Principles

1. **Configuration-Driven**: Flow model is defined in JSON config, not hardcoded
2. **No Backend Changes**: Uses existing data contracts (lots, genealogy, QC decisions)
3. **Performance-First**: Smooth rendering with <100 items, no layout thrash
4. **Role-Aware**: Read-only vs operator interactions based on user role
5. **Accessibility**: Clear active-step cues, high contrast status badges

---

## Goal

Create a lane-based production flow UI that:

- Renders buffer lanes (LK, MIX, SKW15, SKW30) with lot cards
- Displays temperature, weight, and quantity badges per lot
- Implements a gate stepper overlay for progression through QC gates
- Supports role-aware interactions (OPERATOR can interact, VIEWER is read-only)
- Maintains <500 line files and <50 line functions per CLAUDE.md

## Why

- **INITIAL-3.md Deliverable**: MVP decision chose "Lane-based flow map + step overlay"
- **Operator UX**: Clear visual progression through production phases
- **Audit Compliance**: QC decisions remain immutable, UI reflects this
- **Performance**: Efficient rendering for realistic lot volumes

## What

### Deliverables Summary

| Deliverable | Purpose | Location |
|-------------|---------|----------|
| Flow Config Schema | Data model for buffers, lots, gates | `src/types/flow.ts` |
| BufferLane Component | Lane container with lot cards | `src/components/flow/BufferLane.tsx` |
| LotCard Component | Individual lot with badges | `src/components/flow/LotCard.tsx` |
| GateStepper Component | Gate progression overlay | `src/components/flow/GateStepper.tsx` |
| useFlowStore | Flow-specific state management | `src/stores/useFlowStore.ts` |
| Flow Config JSON | Seed data for buffers/lots | `public/scenarios/first-flow-config.json` |

### Success Criteria

- [ ] Buffer lanes render with correct lot cards from config
- [ ] Temperature badges show color-coded status (green/yellow/red)
- [ ] Weight badges display with kg unit
- [ ] Gate stepper shows active gate with visual highlight
- [ ] Role-based affordances (no edit buttons for VIEWER role)
- [ ] No frame drops when rendering 50+ lot cards
- [ ] All components under 500 lines, functions under 50 lines

---

## All Needed Context

### Codebase References

```yaml
# Existing Patterns to Follow
- path: flow-viz-react/src/components/flow/FlowCanvas.tsx
  why: Existing flow visualization pattern with streams and phases
  content: Stream-based layout, status calculation, localization support

- path: flow-viz-react/src/components/flow/StreamNode.tsx
  why: Individual node component pattern with status badges
  content: Status icons, active/completed states, stream color integration

- path: flow-viz-react/src/stores/useProductionStore.ts
  why: Zustand store pattern with devtools middleware
  content: PHASE_LOT_CONFIG mapping, auto-registration, optimistic updates

- path: flow-viz-react/src/types/scenario.ts
  why: Existing type definitions for localization, phases, streams
  content: LocalizedString, PhaseConfig, StreamConfig, NodeStatus

- path: flow-viz-react/src/lib/schemas.ts
  why: Zod validation patterns for lot registration
  content: lotRegistrationSchema with weight/temp ranges
```

### External Documentation

```yaml
# Lane-Based UI Patterns
- url: https://www.shadcn.io/components/data/kanban
  why: shadcn/ui Kanban component with React Context state sharing
  content: Hardware acceleration, memoization, TypeScript interfaces

- url: https://github.com/barishazar3431/react-kanban-board
  why: TypeScript + TailwindCSS kanban with dnd-kit
  content: Column-based layout, drag/drop patterns

- url: https://medium.com/learnreactui/kanban-board-development-with-react-0d15c143ebe7
  why: Kanban board architecture patterns
  content: Lane/card structure, event handling
```

### Seed Data (from INITIAL-3.md)

```yaml
buffers:
  LK:
    name: { hu: "LK Buffer", en: "LK Buffer" }
    tempRange: "0–4°C"
    lots:
      - code: "BULK-20260114-DUNA-5001"
        description: "Mell"
        weight_kg: 200
      - code: "BULK-20260114-DUNA-5002"
        description: "Bőr"
        weight_kg: 30
      - code: "BULK-20260114-DUNA-5003"
        description: "Combfilé"
        weight_kg: 120
  MIX:
    name: { hu: "MIX Buffer", en: "MIX Buffer" }
    tempRange: "0–4°C"
    lots:
      - code: "MIXLOT-20260115-DUNA-0001"
        description: "Today's Mix"
        weight_kg: 1070
  SKW15:
    name: { hu: "SKW15 Buffer", en: "SKW15 Buffer" }
    tempRange: "0–4°C"
    lots:
      - code: "SKW15-20260115-DUNA-0001"
        description: "15kg rods"
        quantity: 20
      - code: "SKW15-20260115-DUNA-0002"
        description: "15kg rods"
        quantity: 20
  SKW30:
    name: { hu: "SKW30 Buffer", en: "SKW30 Buffer" }
    tempRange: "0–4°C"
    lots:
      - code: "SKW30-20260115-DUNA-0001"
        description: "30kg rods"
        quantity: 8
      - code: "SKW30-20260115-DUNA-0002"
        description: "30kg rods"
        quantity: 7

qcGates:
  - id: 1
    name: { hu: "Átvétel", en: "Receipt" }
  - id: 3
    name: { hu: "Csontozás", en: "Deboning" }
  - id: 4
    name: { hu: "BULK Ready", en: "BULK Ready" }
  - id: 5
    name: { hu: "Keverés", en: "Mix" }
  - id: 6
    name: { hu: "Nyárs Mérés", en: "Skewer Weigh" }
  - id: 6.5
    name: { hu: "SKU Split", en: "SKU Split" }
  - id: 7
    name: { hu: "Fagyasztás", en: "Freeze" }
  - id: 8
    name: { hu: "TBD", en: "TBD" }
```

### Temperature Badge Rules

```typescript
// Temperature status colors based on buffer type
const getTempStatus = (temp: number, bufferType: string): 'ok' | 'warning' | 'critical' => {
  if (bufferType === 'FRZ') {
    // Frozen: -25°C to -18°C
    if (temp >= -25 && temp <= -18) return 'ok';
    if (temp > -18 && temp <= -10) return 'warning';
    return 'critical';
  }
  // Chilled: 0°C to 4°C
  if (temp >= 0 && temp <= 4) return 'ok';
  if (temp > 4 && temp <= 7) return 'warning';
  return 'critical';
};
```

---

## Implementation Blueprint

### Type Definitions

```typescript
// src/types/flow.ts

import type { LocalizedString, NodeStatus } from './scenario';

/** Buffer configuration for lane rendering */
export interface BufferConfig {
  id: string;
  name: LocalizedString;
  tempRange: string;
  lotType: 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG';
  color: string;
}

/** Lot card data for rendering */
export interface FlowLot {
  id: string;
  code: string;
  description: LocalizedString;
  weight_kg?: number;
  quantity?: number;
  temperature_c?: number;
  qcStatus: NodeStatus;
  bufferId: string;
}

/** QC Gate for stepper */
export interface FlowGate {
  id: number | string;
  name: LocalizedString;
  isActive: boolean;
  isCompleted: boolean;
}

/** First Flow configuration */
export interface FirstFlowConfig {
  buffers: Record<string, BufferConfig>;
  lots: FlowLot[];
  gates: FlowGate[];
}
```

### Task Breakdown

```yaml
Task 1 - Create Type Definitions:
  action: Define TypeScript interfaces for flow config
  files:
    - CREATE src/types/flow.ts
  content:
    - BufferConfig, FlowLot, FlowGate interfaces
    - FirstFlowConfig aggregate type
    - Export from types/index.ts
  validation:
    - npx tsc --noEmit

Task 2 - Create Flow Store:
  action: Implement Zustand store for flow state
  files:
    - CREATE src/stores/useFlowStore.ts
  content:
    - State: buffers, lots, gates, activeGateId
    - Actions: loadFlowConfig, setActiveGate, advanceGate
    - Pattern: Follow useProductionStore with devtools
  validation:
    - Import and call loadFlowConfig without errors

Task 3 - Create BufferLane Component:
  action: Implement lane container with header and lot slots
  files:
    - CREATE src/components/flow/BufferLane.tsx
  content:
    - Props: buffer (BufferConfig), lots (FlowLot[]), lang
    - Render: Header with name/temp range, lot cards grid
    - Style: Glass card, stream color border
  validation:
    - Render with mock data, no console errors

Task 4 - Create LotCard Component:
  action: Implement individual lot card with badges
  files:
    - CREATE src/components/flow/LotCard.tsx
  content:
    - Props: lot (FlowLot), onClick?, isSelected?
    - Render: Code, description, weight/quantity badge, temp badge
    - Style: Status-colored border, hover effect
  validation:
    - Render with mock lot, badges display correctly

Task 5 - Create Temperature Badge:
  action: Implement reusable temperature status badge
  files:
    - CREATE src/components/flow/TempBadge.tsx
  content:
    - Props: temperature (number), bufferType (string)
    - Logic: getTempStatus() for color determination
    - Style: Green/yellow/red with thermometer icon
  validation:
    - Render badges for various temperatures

Task 6 - Create GateStepper Component:
  action: Implement QC gate progression overlay
  files:
    - CREATE src/components/flow/GateStepper.tsx
  content:
    - Props: gates (FlowGate[]), activeGateId, onGateClick?
    - Render: Horizontal stepper with gate labels
    - Style: Active gate highlighted, completed gates checkmarked
  validation:
    - Render with mock gates, active state visible

Task 7 - Create FirstFlowPage Component:
  action: Compose lane UI with gate stepper
  files:
    - CREATE src/components/flow/FirstFlowPage.tsx
  content:
    - Layout: GateStepper at top, BufferLanes below
    - State: Load from useFlowStore
    - Role: Check useAuthStore for operator vs viewer
  validation:
    - Full page renders with all components

Task 8 - Create Seed Config JSON:
  action: Create configuration file with seed data
  files:
    - CREATE public/scenarios/first-flow-config.json
  content:
    - Buffers: LK, MIX, SKW15, SKW30 from INITIAL-3.md
    - Lots: Example lots per buffer
    - Gates: QC gate sequence from INITIAL-3.md
  validation:
    - JSON parses without errors, matches TypeScript types

Task 9 - Add Route and Navigation:
  action: Integrate FirstFlowPage into app navigation
  files:
    - UPDATE src/App.tsx (add route)
    - UPDATE src/components/shell/ShellNav.tsx (add link)
  content:
    - Route: /first-flow
    - Nav: Add "First Flow" tab
  validation:
    - Navigate to /first-flow, page renders

Task 10 - Role-Aware Interactions:
  action: Implement conditional UI based on user role
  files:
    - UPDATE src/components/flow/LotCard.tsx
    - UPDATE src/components/flow/GateStepper.tsx
  content:
    - OPERATOR: Click handlers enabled, edit affordances
    - VIEWER: Read-only, no click handlers
    - AUDITOR: Read-only with audit info visible
  validation:
    - Test with different roles, UI changes appropriately
```

### Pseudocode: BufferLane Component

```typescript
// src/components/flow/BufferLane.tsx
import { cn } from '../../lib/utils';
import { LotCard } from './LotCard';
import type { BufferConfig, FlowLot } from '../../types/flow';
import type { Language } from '../../types/scenario';

interface BufferLaneProps {
  buffer: BufferConfig;
  lots: FlowLot[];
  lang: Language;
  onLotClick?: (lot: FlowLot) => void;
}

export function BufferLane({ buffer, lots, lang, onLotClick }: BufferLaneProps) {
  const bufferName = buffer.name[lang];

  return (
    <div
      className="glass-card p-4 rounded-xl"
      style={{ borderLeft: `4px solid ${buffer.color}` }}
    >
      {/* Lane Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{bufferName}</h3>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {buffer.tempRange}
        </span>
      </div>

      {/* Lot Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {lots.map((lot) => (
          <LotCard
            key={lot.id}
            lot={lot}
            lang={lang}
            onClick={onLotClick ? () => onLotClick(lot) : undefined}
          />
        ))}
        {lots.length === 0 && (
          <div className="col-span-full text-center text-xs text-[var(--color-text-secondary)] py-8">
            {lang === 'hu' ? 'Nincs LOT ebben a bufferben' : 'No lots in this buffer'}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Pseudocode: LotCard Component

```typescript
// src/components/flow/LotCard.tsx
import { cn } from '../../lib/utils';
import { TempBadge } from './TempBadge';
import type { FlowLot } from '../../types/flow';
import type { Language } from '../../types/scenario';

interface LotCardProps {
  lot: FlowLot;
  lang: Language;
  onClick?: () => void;
  isSelected?: boolean;
}

export function LotCard({ lot, lang, onClick, isSelected }: LotCardProps) {
  const description = lot.description[lang];
  const hasWeight = lot.weight_kg !== undefined;
  const hasQuantity = lot.quantity !== undefined;

  const statusColors: Record<string, string> = {
    pass: 'border-[var(--status-pass)]',
    processing: 'border-[var(--status-processing)]',
    pending: 'border-[var(--status-pending)]',
    hold: 'border-[var(--status-hold)]',
    fail: 'border-[var(--status-fail)]',
  };

  return (
    <div
      className={cn(
        'bg-[rgba(26,31,58,0.8)] border-2 rounded-lg p-3 cursor-pointer',
        'transition-all duration-200 hover:scale-[1.02] hover:shadow-lg',
        statusColors[lot.qcStatus] || 'border-gray-600',
        isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-[var(--color-bg-dark)]'
      )}
      onClick={onClick}
    >
      {/* Lot Code */}
      <div className="font-mono text-[10px] text-[var(--color-text-secondary)] truncate">
        {lot.code}
      </div>

      {/* Description */}
      <div className="text-xs font-medium text-white mt-1 truncate">
        {description}
      </div>

      {/* Badges Row */}
      <div className="flex items-center gap-2 mt-2">
        {hasWeight && (
          <span className="text-[10px] bg-[var(--color-accent-blue)] text-white px-2 py-0.5 rounded">
            {lot.weight_kg} kg
          </span>
        )}
        {hasQuantity && (
          <span className="text-[10px] bg-[var(--color-accent-purple)] text-white px-2 py-0.5 rounded">
            {lot.quantity} pcs
          </span>
        )}
        {lot.temperature_c !== undefined && (
          <TempBadge temperature={lot.temperature_c} bufferType={lot.bufferId} />
        )}
      </div>
    </div>
  );
}
```

### Pseudocode: GateStepper Component

```typescript
// src/components/flow/GateStepper.tsx
import { cn } from '../../lib/utils';
import type { FlowGate } from '../../types/flow';
import type { Language } from '../../types/scenario';

interface GateStepperProps {
  gates: FlowGate[];
  lang: Language;
  onGateClick?: (gateId: number | string) => void;
}

export function GateStepper({ gates, lang, onGateClick }: GateStepperProps) {
  return (
    <div className="glass-card p-4 rounded-xl mb-6">
      <div className="flex items-center justify-between overflow-x-auto">
        {gates.map((gate, idx) => (
          <div key={gate.id} className="flex items-center">
            {/* Gate Node */}
            <button
              onClick={onGateClick ? () => onGateClick(gate.id) : undefined}
              disabled={!onGateClick}
              className={cn(
                'flex flex-col items-center min-w-[80px] px-2',
                onGateClick && 'cursor-pointer hover:opacity-80'
              )}
            >
              {/* Circle */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                  'border-2 transition-all duration-300',
                  gate.isCompleted && 'bg-[var(--status-pass)] border-[var(--status-pass)] text-black',
                  gate.isActive && !gate.isCompleted && 'bg-[var(--status-processing)] border-[var(--status-processing)] text-white animate-pulse',
                  !gate.isActive && !gate.isCompleted && 'bg-transparent border-gray-500 text-gray-400'
                )}
              >
                {gate.isCompleted ? '✓' : gate.id}
              </div>

              {/* Label */}
              <span className={cn(
                'text-[10px] mt-1 text-center whitespace-nowrap',
                gate.isActive ? 'text-white font-semibold' : 'text-[var(--color-text-secondary)]'
              )}>
                {gate.name[lang]}
              </span>
            </button>

            {/* Connector Line */}
            {idx < gates.length - 1 && (
              <div className={cn(
                'h-0.5 w-8 flex-shrink-0',
                gate.isCompleted ? 'bg-[var(--status-pass)]' : 'bg-gray-600'
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Validation Loop

### Level 1: TypeScript Compilation

```bash
# Navigate to frontend
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/flow-viz-react

# Type check
npx tsc --noEmit

# Expected: No errors
# If failing: Fix type definitions or imports
```

### Level 2: ESLint

```bash
# Lint check
npm run lint

# Expected: No errors or warnings
# If failing: Fix lint issues
```

### Level 3: Component Rendering

```bash
# Start dev server
npm run dev

# Manual validation:
# 1. Navigate to /first-flow
# 2. Verify buffer lanes render
# 3. Verify lot cards display correctly
# 4. Verify gate stepper shows active gate
# 5. Verify temperature badges show correct colors
```

### Level 4: Role-Based UI

```bash
# Test with different roles (modify useAuthStore mock):
# 1. OPERATOR: Click handlers enabled
# 2. VIEWER: Read-only mode
# 3. AUDITOR: Read-only with audit info

# Verify no console errors for each role
```

### Level 5: Performance Check

```bash
# Add 50+ lots to config and verify:
# 1. No frame drops during initial render
# 2. Smooth scroll in buffer lanes
# 3. No re-render loops (check React DevTools)
```

---

## Final Validation Checklist

### Component Implementation

- [ ] `src/types/flow.ts` - Type definitions created
- [ ] `src/stores/useFlowStore.ts` - Zustand store implemented
- [ ] `src/components/flow/BufferLane.tsx` - Lane component created (<200 lines)
- [ ] `src/components/flow/LotCard.tsx` - Card component created (<100 lines)
- [ ] `src/components/flow/TempBadge.tsx` - Badge component created (<50 lines)
- [ ] `src/components/flow/GateStepper.tsx` - Stepper component created (<150 lines)
- [ ] `src/components/flow/FirstFlowPage.tsx` - Page component created (<200 lines)

### Configuration

- [ ] `public/scenarios/first-flow-config.json` - Seed data created
- [ ] Config matches INITIAL-3.md examples
- [ ] JSON validates against TypeScript types

### Integration

- [ ] Route added to App.tsx
- [ ] Navigation link added to ShellNav.tsx
- [ ] Flow loads from config on page mount
- [ ] Language switching works (hu/en)

### Quality

- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] All files under 500 lines
- [ ] All functions under 50 lines
- [ ] Smooth rendering with 50+ lots

### Role Enforcement

- [ ] OPERATOR: Interactive affordances visible
- [ ] VIEWER: Read-only mode, no click handlers
- [ ] AUDITOR: Read-only with audit-relevant info

---

## Anti-Patterns to Avoid

### Component Architecture

- ❌ Don't hardcode buffer/lot data - use configuration
- ❌ Don't put business logic in components - use store actions
- ❌ Don't use inline styles for theme colors - use CSS variables
- ❌ Don't skip localization - always use LocalizedString

### State Management

- ❌ Don't duplicate state between stores - single source of truth
- ❌ Don't mutate state directly - use Zustand set()
- ❌ Don't skip devtools middleware - needed for debugging

### Performance

- ❌ Don't render all lots in one component - use virtualization if >100
- ❌ Don't use anonymous functions in JSX - extract to component level
- ❌ Don't skip React.memo for lot cards - they re-render frequently

### Accessibility

- ❌ Don't skip focus indicators - operators use keyboard
- ❌ Don't use color alone for status - add icons/text
- ❌ Don't make badges too small - min touch target 44px

---

## Quick Reference

### Commands

```bash
# Development
cd flow-viz-react && npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build
```

### File Locations

| Artifact | Path |
|----------|------|
| Type Definitions | `src/types/flow.ts` |
| Flow Store | `src/stores/useFlowStore.ts` |
| Buffer Lane | `src/components/flow/BufferLane.tsx` |
| Lot Card | `src/components/flow/LotCard.tsx` |
| Temp Badge | `src/components/flow/TempBadge.tsx` |
| Gate Stepper | `src/components/flow/GateStepper.tsx` |
| First Flow Page | `src/components/flow/FirstFlowPage.tsx` |
| Config JSON | `public/scenarios/first-flow-config.json` |

### Existing Patterns

| Pattern | Reference File |
|---------|----------------|
| Stream Layout | `src/components/flow/FlowCanvas.tsx` |
| Node Status | `src/components/flow/StreamNode.tsx` |
| Zustand Store | `src/stores/useProductionStore.ts` |
| Localization | `src/types/scenario.ts` |
| Glass Card | CSS variable `glass-card` in global styles |

---

## Confidence Score

**8/10** — High confidence for one-pass implementation

### Strengths

- Clear spec with seed data examples
- Existing flow components provide patterns
- Zustand store pattern well-established
- No backend changes required

### Risks

- Temperature badge color logic needs testing
- Role-based UI may need refinement after stakeholder review
- Performance with 100+ lots not benchmarked

---

## Sources

- [shadcn/ui Kanban Component](https://www.shadcn.io/components/data/kanban)
- [React Kanban TypeScript Example](https://github.com/barishazar3431/react-kanban-board)
- [Kanban Board Development with React](https://medium.com/learnreactui/kanban-board-development-with-react-0d15c143ebe7)
- INITIAL-3.md - Phase 3 First Flow Specification
- CLAUDE.md - Code Standards and Conventions

---

_PRP generated for INITIAL-3.md Phase 3 First Flow feature. Implements lane-based flow map with step overlay._
