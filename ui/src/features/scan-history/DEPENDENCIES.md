# Scan History Feature Dependencies

> Generated: 2026-01-31
> Feature: Scan History with Timeline Visualization

## Dependency Verification Summary

| Check | Status | Notes |
|-------|--------|-------|
| Runtime dependencies | PASS | All required packages installed |
| Dev dependencies | PASS | Testing tools available |
| Internal dependencies | PASS | @/core and @/shared modules exist |
| Path aliases | PASS | @/* configured in tsconfig.json |

---

## Required Runtime Dependencies

### Core UI Framework

| Package | Required | Installed | Purpose |
|---------|----------|-----------|---------|
| react | ^18.2.0 | 18.2.0 | React framework |
| react-dom | ^18.2.0 | 18.2.0 | React DOM rendering |

### Feature-Specific Dependencies

| Package | Required | Installed | Purpose |
|---------|----------|-----------|---------|
| recharts | ^3.7.0 | 3.7.0 | Timeline chart visualization (AreaChart, BarChart, ResponsiveContainer) |
| @tanstack/react-query | ^5.8.0 | 5.90.20 | Server state management, caching, background refetching |
| zustand | ^4.4.7 | 4.5.7 | Client-side state management (filters, selections, UI state) |
| react-router-dom | ^6.20.0 | 6.30.3 | Routing, URL state synchronization |
| clsx | ^2.0.0 | 2.1.1 | Conditional class name composition |
| tailwind-merge | ^2.1.0 | 2.6.0 | Intelligent Tailwind class merging |
| axios | ^1.6.2 | - | HTTP client (via @/core/api) |
| lucide-react | ^0.294.0 | - | Icon library (via @/shared) |

### Optional Dependencies (Not Required)

| Package | Status | Notes |
|---------|--------|-------|
| date-fns | NOT INSTALLED | Not needed - feature uses native Date APIs with custom dateHelpers.ts |

---

## Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.3.2 | Type checking |
| vitest | ^1.6.0 | Unit and integration testing |
| @testing-library/react | ^14.2.0 | React component testing |
| @testing-library/user-event | ^14.5.0 | User interaction simulation |
| @faker-js/faker | ^8.4.0 | Test data generation |
| msw | ^2.2.0 | API mocking for integration tests |
| @vitest/coverage-v8 | ^1.6.0 | Code coverage reporting |

---

## Internal Dependencies

### @/core/api

**Path:** `src/core/api/client.ts`

**Used by:**
- `api.ts` - API client functions

**Imports:**
```typescript
import { get, post, buildQueryString } from '@/core/api/client';
import { ApiClientError } from '@/core/api/client';
```

### @/shared

**Path:** `src/shared/`

**Used by:**
- All component files

**Imports:**
```typescript
// UI Components
import { Button, Card, CardContent, Badge, Spinner, Alert } from '@/shared';
import { Input, StatusBadge, Skeleton } from '@/shared';

// Utilities
import { cn } from '@/shared/utils';
```

---

## Recharts Usage Details

The timeline chart component uses the following Recharts modules:

```typescript
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
```

**Chart Types:**
- `AreaChart` - Primary timeline visualization with stacked areas
- `BarChart` - Alternative view for discrete time buckets

**Features Used:**
- `ResponsiveContainer` - Auto-sizing to parent
- `Tooltip` - Hover information
- `Legend` - Status color key
- `CartesianGrid` - Grid lines
- Custom colors via `Cell` components

---

## Zustand Store Configuration

```typescript
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
```

**Middlewares:**
- `devtools` - Redux DevTools integration
- `subscribeWithSelector` - Fine-grained subscriptions

---

## React Query Configuration

The feature uses React Query with the following patterns:

```typescript
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
```

**Query Key Factory:**
```typescript
// hooks/queryKeys.ts
export const scanHistoryQueryKeys = {
  all: ['scanHistory'] as const,
  lists: () => [...scanHistoryQueryKeys.all, 'list'] as const,
  list: (filters) => [...scanHistoryQueryKeys.lists(), filters] as const,
  details: () => [...scanHistoryQueryKeys.all, 'detail'] as const,
  detail: (id) => [...scanHistoryQueryKeys.details(), id] as const,
  timeline: (options) => [...scanHistoryQueryKeys.all, 'timeline', options] as const,
  diff: (ids) => [...scanHistoryQueryKeys.all, 'diff', ids] as const,
};
```

---

## Path Alias Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**Vite config (vite.config.ts) should include:**
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

---

## Installation Commands

### Full Installation (if starting fresh)
```bash
cd /Volumes/Externalwork/code-reviewer/ui
npm install
```

### Verify Dependencies
```bash
npm ls recharts @tanstack/react-query zustand react-router-dom clsx tailwind-merge
```

### Add Missing Dependencies (if any)
```bash
# Example if a package is missing
npm install <package-name>
```

---

## Compatibility Notes

### Node.js Version
- **Minimum:** Node.js 18.x
- **Recommended:** Node.js 20.x or 22.x

### Browser Support
Based on Vite's default configuration:
- Chrome 87+
- Firefox 78+
- Safari 14+
- Edge 88+

### TypeScript Version
- **Required:** TypeScript 5.0+
- **Configured:** TypeScript 5.3.2

---

## Feature Module Structure

```
src/features/scan-history/
├── api.ts                    # API client functions
├── index.ts                  # Public exports
├── DEPENDENCIES.md           # This file
├── components/
│   ├── index.ts
│   ├── ScanHistoryPage.tsx   # Main page component
│   ├── ScanTimelineChart.tsx # Recharts visualization
│   ├── ScanListTable.tsx     # Data table
│   ├── ScanFilterPanel.tsx   # Filter controls
│   ├── ScanComparisonPanel.tsx
│   ├── ScanHistoryErrorBoundary.tsx
│   └── ScanHistoryErrorDisplay.tsx
├── hooks/
│   ├── index.ts
│   ├── queries.ts            # React Query hooks
│   ├── queryKeys.ts          # Query key factory
│   ├── useScanHistoryUrlState.ts
│   └── useScanHistoryErrorHandler.ts
├── store/
│   ├── index.ts
│   └── useScanHistoryStore.ts  # Zustand store
├── types/
│   ├── index.ts
│   ├── domain.ts
│   ├── api.ts
│   ├── store.ts
│   ├── components.ts
│   └── hooks.ts
├── utils/
│   ├── index.ts
│   ├── dateHelpers.ts        # Date utilities (no external deps)
│   ├── diffHelpers.ts
│   ├── filterHelpers.ts
│   ├── errorHandler.ts
│   ├── errorLogging.ts
│   └── logger.ts
└── config/
    ├── index.ts
    ├── constants.ts
    ├── env.ts
    └── types.ts
```

---

## Dependency Security Notes

All dependencies are from trusted sources (npm registry) with active maintenance:

| Package | Last Update | Security |
|---------|-------------|----------|
| recharts | Active | No known vulnerabilities |
| @tanstack/react-query | Active | No known vulnerabilities |
| zustand | Active | No known vulnerabilities |
| react-router-dom | Active | No known vulnerabilities |

Run security audit:
```bash
npm audit
```

---

## For Downstream Agents

### Implementation Coordinator (Next Agent)
- All dependencies verified and installed
- Feature module structure documented
- Internal dependencies (@/core, @/shared) confirmed working

### Test Generator
- Vitest and Testing Library available
- MSW available for API mocking
- Faker available for test data

### Build/Deploy
- No additional dependencies needed
- Standard Vite build process applies
