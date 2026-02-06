# Graph Feature Dependencies

Documentation of all dependencies used by the Graph Visualization feature.

## Production Dependencies

### Core Graph Rendering

| Package | Version | Purpose |
|---------|---------|---------|
| `@xyflow/react` | ^12.10.0 | React Flow v12 - Core graph rendering library for node-based visualizations |
| `dagre` | ^0.8.5 | Directed graph layout algorithm for automatic node positioning |
| `@types/dagre` | ^0.7.53 | TypeScript type definitions for dagre |

### Search & Filtering

| Package | Version | Purpose |
|---------|---------|---------|
| `fuse.js` | ^7.1.0 | Fuzzy search library for node search functionality |

### State Management

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-query` | ^5.8.0 | Server state management, caching, and data fetching |
| `zustand` | ^4.4.7 | Lightweight client state management |

### UI Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| `clsx` | ^2.0.0 | Utility for constructing className strings conditionally |
| `tailwind-merge` | ^2.1.0 | Merge Tailwind CSS classes without style conflicts |
| `lucide-react` | ^0.294.0 | Icon library for UI elements |

### Routing

| Package | Version | Purpose |
|---------|---------|---------|
| `react-router-dom` | ^6.20.0 | URL state synchronization for graph filters and selection |

## Peer Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.0 | Required by @xyflow/react v12 |
| `react-dom` | ^18.2.0 | Required by @xyflow/react v12 |

## Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.3.2 | TypeScript compiler |
| `vitest` | ^1.6.0 | Unit and integration testing |
| `@testing-library/react` | ^14.2.0 | React component testing utilities |
| `@faker-js/faker` | ^8.4.0 | Test data generation |

## Version Compatibility Matrix

### @xyflow/react v12 Requirements

- React: ^18.0.0 (using 18.3.1)
- React DOM: ^18.0.0 (using 18.3.1)
- TypeScript: ^5.0.0 (using 5.3.2)

All peer dependency requirements are satisfied.

## Import Path Conventions

The feature uses TypeScript path aliases configured in `tsconfig.json`:

```typescript
// Feature public API
import { useGraph, GraphCanvas } from '@/features/graph';

// Internal imports (within feature)
import { useGraph } from './hooks';
import { GraphCanvas } from './components';
import { calculateLayout } from './utils';
import { GraphDataService } from './services';
import { graphConfig } from './config';
import type { GraphNode, FlowNode } from './types';
```

## Module Structure

```
/features/graph/
  index.ts              # Main barrel export (public API)
  types.ts              # Core type definitions
  api.ts                # API functions
  /types/
    index.ts            # Types barrel export
    api.ts              # API types
    components.ts       # Component prop types
    hooks.ts            # Hook types
  /components/
    index.ts            # Components barrel export
    CustomNode.tsx
    GraphCanvas.tsx
    FilterPanel.tsx
    SearchBar.tsx
    DetailPanel.tsx
    GraphSkeleton.tsx
    GraphEmptyState.tsx
    GraphToolbar.tsx
    GraphLegend.tsx
    GraphErrorBoundary.tsx
  /hooks/
    index.ts            # Hooks barrel export
    useGraph.ts
    useGraphPreferences.ts
    useGraphUrlState.ts
    useGraphErrorHandling.ts
    useQueryLogger.ts
    queryKeys.ts
    queryOptions.ts
    queries.ts
  /utils/
    index.ts            # Utils barrel export
    constants.ts
    layout.ts
    transformers.ts
    filters.ts
    search.ts
    urlState.ts
    blastRadius.ts
    errorHandler.ts
    validation.ts
    recovery.ts
    errorLogging.ts
    logger.ts
    performanceLogger.ts
    actionLogger.ts
    debug.ts
  /services/
    index.ts            # Services barrel export
    graphDataService.ts
    layoutService.ts
    selectionService.ts
    filterService.ts
    blastRadiusService.ts
    exportService.ts
  /config/
    index.ts            # Config barrel export
    types.ts
    env.ts
    runtime.ts
    featureFlags.ts
    GraphConfigProvider.tsx
```

## Dependency Graph

```
@xyflow/react (graph rendering)
    |
    +-- dagre (layout algorithm)
    |
    +-- fuse.js (search)
    |
    +-- @tanstack/react-query (data fetching)
    |       |
    |       +-- zustand (local state)
    |
    +-- react-router-dom (URL state)
```

## Security Notes

- All dependencies are from npm public registry
- No known critical vulnerabilities in graph-specific dependencies
- Regular audits recommended: `npm audit`

## Update Policy

1. **@xyflow/react**: Follow major version updates carefully; v12 has breaking changes from v11
2. **dagre**: Stable library, minimal updates expected
3. **fuse.js**: Safe to update minor/patch versions
4. **@tanstack/react-query**: Follow v5 migration guide for major updates

## Troubleshooting

### Common Issues

1. **React Flow type errors**: Ensure `@xyflow/react` version matches type definitions
2. **Layout not working**: Verify dagre is installed and imported correctly
3. **Search not finding results**: Check fuse.js options in `utils/constants.ts`

### Verification Commands

```bash
# Check all dependencies are installed
npm ls @xyflow/react dagre fuse.js

# Verify no version conflicts
npm ls --all | grep -E "(UNMET|invalid)"

# Run type check
npm run typecheck

# Check for security vulnerabilities
npm audit
```
