# Frontend Integration: Terragrunt Node Types (TASK-TG-007)

## Overview

This document describes the frontend integration requirements for rendering `TerragruntIncludeNode` and `TerragruntDependencyNode` types introduced in TASK-TG-007.

**Note**: TASK-TG-007 is a backend types task. Frontend implementation is documented here for future work but is **out of scope** for this task.

## New Node Types

### 1. TerragruntIncludeNode (`tg_include`)

Represents a Terragrunt `include` block that references a parent configuration file.

#### Backend Type Definition

```typescript
interface TerragruntIncludeNode extends BaseNode {
  readonly type: 'tg_include';
  readonly label: string;           // Include block label (e.g., "root", "common")
  readonly path: string;            // Original HCL path expression
  readonly resolvedPath: string | null;  // Resolved absolute path
  readonly expose: boolean;         // Whether included values are exposed
  readonly mergeStrategy: 'no_merge' | 'shallow' | 'deep';
}
```

#### HCL Example

```hcl
include "root" {
  path = find_in_parent_folders("root.hcl")
  expose = true
  merge_strategy = "deep"
}
```

### 2. TerragruntDependencyNode (`tg_dependency`)

Represents a Terragrunt `dependency` block that references another module.

#### Backend Type Definition

```typescript
interface TerragruntDependencyNode extends BaseNode {
  readonly type: 'tg_dependency';
  readonly dependencyName: string;   // Dependency block name (e.g., "vpc")
  readonly configPath: string;       // Original config_path expression
  readonly resolvedPath: string | null;  // Resolved absolute path
  readonly skipOutputs: boolean;     // Whether outputs are skipped
  readonly hasMockOutputs: boolean;  // Whether mock_outputs is defined
}
```

#### HCL Example

```hcl
dependency "vpc" {
  config_path = "../vpc"
  skip_outputs = false
  mock_outputs = { vpc_id = "mock-vpc-123" }
}
```

## Frontend Detection

### Type Discriminator

Frontend clients detect new node types via the `type` field in the API response:

```typescript
// Type checking
if (node.type === 'tg_include') {
  // Handle include node
}

if (node.type === 'tg_dependency') {
  // Handle dependency node
}

// Type guard pattern (recommended)
function isTerragruntIncludeNode(node: GraphNode): node is TerragruntIncludeNode {
  return node.type === 'tg_include';
}

function isTerragruntDependencyNode(node: GraphNode): node is TerragruntDependencyNode {
  return node.type === 'tg_dependency';
}
```

### API Response Structure

Nodes are returned from the graph API with metadata containing type-specific properties:

```json
{
  "id": "node-uuid",
  "name": "root",
  "type": "tg_include",
  "location": {
    "filePath": "/path/to/terragrunt.hcl",
    "startLine": 1,
    "endLine": 5
  },
  "metadata": {
    "label": "root",
    "path": "find_in_parent_folders(\"root.hcl\")",
    "resolvedPath": "/absolute/path/to/root.hcl",
    "expose": true,
    "mergeStrategy": "deep"
  }
}
```

## UI Properties Reference

### TerragruntIncludeNode Properties

| Property | Type | UI Usage |
|----------|------|----------|
| `label` | `string` | Display name for the include block |
| `path` | `string` | Show original HCL path expression (may contain functions) |
| `resolvedPath` | `string \| null` | Show resolved absolute path (null if unresolved) |
| `expose` | `boolean` | Badge/indicator if parent values are exposed |
| `mergeStrategy` | `enum` | Show merge type: `no_merge`, `shallow`, `deep` |

### TerragruntDependencyNode Properties

| Property | Type | UI Usage |
|----------|------|----------|
| `dependencyName` | `string` | Display name for the dependency block |
| `configPath` | `string` | Show original `config_path` expression |
| `resolvedPath` | `string \| null` | Show resolved target path (null if unresolved) |
| `skipOutputs` | `boolean` | Indicator if outputs are skipped |
| `hasMockOutputs` | `boolean` | Indicator if mock outputs are defined |

## Recommended Visual Representation

### Color Palette

| Node Type | Primary Color | Hex Code | Rationale |
|-----------|---------------|----------|-----------|
| `tg_include` | Cyan/Blue | `#06B6D4` | Represents inheritance/hierarchy |
| `tg_dependency` | Orange/Amber | `#F59E0B` | Represents external linkage |
| `tg_config` (existing) | Violet | `#8B5CF6` | Base Terragrunt config |

### Icons

| Node Type | Recommended Icon | Alternative |
|-----------|------------------|-------------|
| `tg_include` | Inheritance/merge icon | Layers icon |
| `tg_dependency` | Link/chain icon | Arrow pointing outward |
| `tg_config` | Leaf/plant icon (existing) | File config icon |

### Implementation Suggestion

```typescript
// Extend existing nodeColors in ui/src/features/graph/types.ts
export const nodeColors: Record<GraphNodeType, string> = {
  // ... existing colors ...
  tg_config: '#8B5CF6',      // Existing - Violet
  tg_include: '#06B6D4',     // New - Cyan (inheritance)
  tg_dependency: '#F59E0B',  // New - Amber (links)
};

export const nodeTypeLabels: Record<GraphNodeType, string> = {
  // ... existing labels ...
  tg_config: 'Terragrunt Config',
  tg_include: 'TG Include',      // New
  tg_dependency: 'TG Dependency', // New
};

export const nodeTypeIcons: Record<GraphNodeType, string> = {
  // ... existing icons ...
  tg_config: '\u{1F33F}',       // Existing - herb/leaf emoji
  tg_include: '\u{1F4C2}',      // New - folder with files (inheritance)
  tg_dependency: '\u{1F517}',   // New - chain link
};
```

### Graph Edge Visualization

Include and dependency nodes create edges to their targets:

| Edge Source | Edge Target | Edge Type | Visual Style |
|-------------|-------------|-----------|--------------|
| `tg_config` | `tg_include` | `contains` | Dashed, from config to include block |
| `tg_include` | `tg_config` | `inherits` | Solid, shows inheritance flow |
| `tg_config` | `tg_dependency` | `contains` | Dashed, from config to dependency block |
| `tg_dependency` | `tg_config` | `depends_on` | Animated, shows dependency relationship |

## Detail Panel Enhancements

When a Terragrunt include or dependency node is selected, the DetailPanel should show type-specific information:

### Include Node Detail Panel

```
+----------------------------------+
| [Icon] root                      |
| TG Include                       |
+----------------------------------+
| Location                         |
| /path/to/terragrunt.hcl:1-5      |
+----------------------------------+
| Include Configuration            |
| Path Expression:                 |
|   find_in_parent_folders(...)    |
| Resolved Path:                   |
|   /abs/path/to/root.hcl          |
| Expose:  [Yes]                   |
| Merge:   [deep]                  |
+----------------------------------+
```

### Dependency Node Detail Panel

```
+----------------------------------+
| [Icon] vpc                       |
| TG Dependency                    |
+----------------------------------+
| Location                         |
| /path/to/terragrunt.hcl:10-15    |
+----------------------------------+
| Dependency Configuration         |
| Config Path:                     |
|   ../vpc                         |
| Resolved Path:                   |
|   /abs/path/to/vpc/tg.hcl        |
| Skip Outputs:  [No]              |
| Has Mocks:     [Yes]             |
+----------------------------------+
```

## Required Frontend Changes (Future Work)

### 1. Type System Updates

**File**: `ui/src/features/graph/types.ts`

- Add `'tg_include'` and `'tg_dependency'` to `GraphNodeType` union
- Add entries to `ALL_NODE_TYPES` array
- Add colors to `nodeColors` map
- Add labels to `nodeTypeLabels` map
- Add icons to `nodeTypeIcons` map
- Add type guards for new node types
- Add metadata interfaces for include/dependency-specific data

### 2. Component Updates

**File**: `ui/src/features/graph/components/DetailPanel.tsx`

- Add specialized rendering for include node metadata
- Add specialized rendering for dependency node metadata
- Show resolve status (resolved vs unresolved)

**File**: `ui/src/features/graph/components/CustomNode.tsx`

- No changes needed (uses type maps automatically)

**File**: `ui/src/features/graph/components/GraphLegend.tsx`

- No changes needed (reads from `ALL_NODE_TYPES`)

**File**: `ui/src/features/graph/components/FilterPanel.tsx`

- No changes needed (reads from `ALL_NODE_TYPES`)

### 3. Filter Updates

**File**: `ui/src/features/graph/types.ts`

- Update `defaultGraphFilters.nodeTypes` to include new types

## Testing Considerations

When implementing frontend support, test the following scenarios:

1. **Resolved Include** - Include node with `resolvedPath` pointing to existing config
2. **Unresolved Include** - Include node with `resolvedPath: null`
3. **Exposed Include** - Include with `expose: true`
4. **Merge Strategies** - All three merge strategies display correctly
5. **Resolved Dependency** - Dependency with resolved target config
6. **Unresolved Dependency** - External or missing dependency target
7. **Mock Outputs** - Dependency with `hasMockOutputs: true`
8. **Skipped Outputs** - Dependency with `skipOutputs: true`
9. **Graph Filtering** - New node types can be filtered in/out
10. **Graph Legend** - New node types appear in legend

## Related Documentation

- [Database Schema](/docs/database-schema.md) - Node type enum includes `tg_include`, `tg_dependency`
- Backend Types: `/api/src/types/graph.ts`
- Repository Helpers: `/api/src/repositories/terragrunt-node-helpers.ts`

## Status

| Item | Status |
|------|--------|
| Backend Types | Implemented |
| Database Schema | Implemented |
| API Endpoints | Implemented |
| Frontend Types | **Pending** |
| Frontend Components | **Pending** |
| Tests | **Pending** |

---

*Last Updated: TASK-TG-007 (Backend Types)*
*Frontend implementation tracked separately*
