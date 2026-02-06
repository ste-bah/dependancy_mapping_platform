# Frontend Integration Specification: Cross-Repository Rollup Feature

**TASK-ROLLUP-001: Cross-Repository Aggregation**
**Agent #25 of 47 | Phase 4: Implementation**
**Document Version:** 1.0.0
**Last Updated:** 2026-01-28

---

## Overview

This document specifies the frontend integration requirements for the Cross-Repository Aggregation (Rollup) feature. The rollup system enables merging dependency nodes across multiple repositories using 4 matching strategies: ARN, ResourceId, Name, and Tag.

---

## 1. API Endpoints Summary

### Base URL
```
/api/v1/rollups
```

### Authentication
All endpoints require Bearer token authentication.

```typescript
headers: {
  'Authorization': 'Bearer <access_token>',
  'X-Tenant-ID': '<tenant_uuid>',  // Required for multi-tenancy
  'Content-Type': 'application/json'
}
```

### Endpoint Reference

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `POST` | `/rollups` | Create rollup configuration | 10/min |
| `GET` | `/rollups` | List rollups (paginated) | 100/min |
| `GET` | `/rollups/:rollupId` | Get rollup by ID | 200/min |
| `PATCH` | `/rollups/:rollupId` | Update rollup | 20/min |
| `DELETE` | `/rollups/:rollupId` | Delete rollup | 10/min |
| `POST` | `/rollups/:rollupId/execute` | Execute rollup | 5/min |
| `GET` | `/rollups/:rollupId/executions/:executionId` | Get execution result | 200/min |
| `POST` | `/rollups/:rollupId/blast-radius` | Compute blast radius | 20/min |
| `POST` | `/rollups/validate` | Validate configuration | 100/min |

---

## 2. TypeScript Types for Frontend

The frontend should mirror these types from the backend. These can be imported directly if using a shared package, or recreated in the frontend codebase.

### Core Types

```typescript
// ============================================================================
// Matching Strategy Types
// ============================================================================

export type MatchingStrategy = 'arn' | 'resource_id' | 'name' | 'tag';

export type RollupStatus =
  | 'draft'
  | 'active'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'archived';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ConflictResolution = 'first' | 'last' | 'merge' | 'error';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Matcher Configuration Types
// ============================================================================

interface BaseMatcherConfig {
  enabled: boolean;
  priority: number;  // 0-100
  minConfidence: number;  // 0-100
  description?: string;
}

export interface ArnMatcherConfig extends BaseMatcherConfig {
  type: 'arn';
  pattern: string;
  allowPartial: boolean;
  components?: {
    partition: boolean;
    service: boolean;
    region: boolean;
    account: boolean;
    resource: boolean;
  };
}

export interface ResourceIdMatcherConfig extends BaseMatcherConfig {
  type: 'resource_id';
  resourceType: string;
  idAttribute: string;
  normalize: boolean;
  extractionPattern?: string;
}

export interface NameMatcherConfig extends BaseMatcherConfig {
  type: 'name';
  pattern?: string;
  includeNamespace: boolean;
  namespacePattern?: string;
  caseSensitive: boolean;
  fuzzyThreshold?: number;  // 0-100
}

export interface TagMatcherConfig extends BaseMatcherConfig {
  type: 'tag';
  requiredTags: Array<{
    key: string;
    value?: string;
    valuePattern?: string;
  }>;
  matchMode: 'all' | 'any';
  ignoreTags?: string[];
}

export type MatcherConfig =
  | ArnMatcherConfig
  | ResourceIdMatcherConfig
  | NameMatcherConfig
  | TagMatcherConfig;

// ============================================================================
// Rollup Configuration Types
// ============================================================================

export interface MergeOptions {
  conflictResolution: ConflictResolution;
  preserveSourceInfo: boolean;
  createCrossRepoEdges: boolean;
  maxNodes?: number;
}

export interface RollupSchedule {
  enabled: boolean;
  cron?: string;
  timezone?: string;
  onScanComplete: boolean;
}

export interface RollupConfig {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: RollupStatus;
  repositoryIds: string[];
  scanIds?: string[];
  matchers: MatcherConfig[];
  includeNodeTypes?: string[];
  excludeNodeTypes?: string[];
  preserveEdgeTypes?: string[];
  mergeOptions: MergeOptions;
  schedule?: RollupSchedule;
  version: number;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;  // ISO date-time
  updatedAt: string;  // ISO date-time
  lastExecutedAt?: string;  // ISO date-time
}

// ============================================================================
// Request Types
// ============================================================================

export interface RollupCreateRequest {
  name: string;
  description?: string;
  repositoryIds: string[];  // Minimum 2 repositories
  scanIds?: string[];
  matchers: MatcherConfig[];  // Minimum 1 matcher
  includeNodeTypes?: string[];
  excludeNodeTypes?: string[];
  preserveEdgeTypes?: string[];
  mergeOptions?: Partial<MergeOptions>;
  schedule?: Partial<RollupSchedule>;
}

export type RollupUpdateRequest = Partial<RollupCreateRequest>;

export interface RollupExecuteRequest {
  scanIds?: string[];
  force: boolean;
  async: boolean;
  callbackUrl?: string;
  options?: {
    skipValidation: boolean;
    includeMatchDetails: boolean;
    timeoutSeconds?: number;  // 1-3600
  };
}

export interface RollupListQuery {
  page?: number;  // Default: 1
  pageSize?: number;  // Default: 20, max: 100
  status?: RollupStatus;
  repositoryId?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastExecutedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface BlastRadiusQuery {
  nodeIds: string[];  // Minimum 1
  maxDepth?: number;  // Default: 5, max: 20
  edgeTypes?: string[];
  includeCrossRepo: boolean;
  includeIndirect: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface RollupSingleResponse {
  success: true;
  data: RollupConfig;
  latestExecution?: {
    id: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    stats?: RollupExecutionStats;
  };
}

export interface RollupPaginatedResponse {
  success: true;
  data: RollupConfig[];
  pagination: PaginationInfo;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface RollupExecutionStats {
  totalNodesProcessed: number;
  nodesMatched: number;
  nodesUnmatched: number;
  totalEdgesProcessed: number;
  crossRepoEdgesCreated: number;
  matchesByStrategy: Record<MatchingStrategy, number>;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  executionTimeMs: number;
  memoryPeakBytes?: number;
}

export interface MatchResult {
  sourceNodeId: string;
  targetNodeId: string;
  sourceRepoId: string;
  targetRepoId: string;
  strategy: MatchingStrategy;
  confidence: number;  // 0-100
  details: {
    matchedAttribute: string;
    sourceValue: string;
    targetValue: string;
    context?: Record<string, unknown>;
  };
}

export interface MergedNode {
  id: string;
  sourceNodeIds: string[];
  sourceRepoIds: string[];
  type: string;
  name: string;
  locations: Array<{
    repoId: string;
    file: string;
    lineStart: number;
    lineEnd: number;
  }>;
  metadata: Record<string, unknown>;
  matchInfo: {
    strategy: MatchingStrategy;
    confidence: number;
    matchCount: number;
  };
}

export interface RollupExecutionResult {
  id: string;
  rollupId: string;
  tenantId: string;
  status: ExecutionStatus;
  scanIds: string[];
  stats?: RollupExecutionStats;
  matches?: MatchResult[];
  mergedNodes?: MergedNode[];
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ExecutionResultResponse {
  success: true;
  data: RollupExecutionResult;
}

// ============================================================================
// Blast Radius Types
// ============================================================================

export interface DirectImpactNode {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  repoId: string;
  repoName: string;
  depth: number;
}

export interface IndirectImpactNode extends DirectImpactNode {
  path: string[];
}

export interface CrossRepoImpact {
  sourceRepoId: string;
  sourceRepoName: string;
  targetRepoId: string;
  targetRepoName: string;
  impactedNodes: number;
  edgeType: string;
}

export interface BlastRadiusSummary {
  totalImpacted: number;
  directCount: number;
  indirectCount: number;
  crossRepoCount: number;
  impactByType: Record<string, number>;
  impactByRepo: Record<string, number>;
  impactByDepth: Record<string, number>;
  riskLevel: RiskLevel;
}

export interface BlastRadiusResponse {
  query: BlastRadiusQuery;
  rollupId: string;
  executionId: string;
  directImpact: DirectImpactNode[];
  indirectImpact: IndirectImpactNode[];
  crossRepoImpact: CrossRepoImpact[];
  summary: BlastRadiusSummary;
}

export interface BlastRadiusResultResponse {
  success: true;
  data: BlastRadiusResponse;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  code: string;
  message: string;
  path: string;
  value?: unknown;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  suggestion?: string;
}

export interface ValidationResponse {
  success: true;
  data: {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  };
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Error codes for handling
export const RollupErrorCodes = {
  INVALID_CONFIGURATION: 'ROLLUP_INVALID_CONFIGURATION',
  INVALID_MATCHER: 'ROLLUP_INVALID_MATCHER',
  REPOSITORY_NOT_FOUND: 'ROLLUP_REPOSITORY_NOT_FOUND',
  SCAN_NOT_FOUND: 'ROLLUP_SCAN_NOT_FOUND',
  EXECUTION_FAILED: 'ROLLUP_EXECUTION_FAILED',
  EXECUTION_TIMEOUT: 'ROLLUP_EXECUTION_TIMEOUT',
  EXECUTION_IN_PROGRESS: 'ROLLUP_EXECUTION_IN_PROGRESS',
  ROLLUP_NOT_FOUND: 'ROLLUP_NOT_FOUND',
  ROLLUP_ALREADY_EXISTS: 'ROLLUP_ALREADY_EXISTS',
  EXECUTION_NOT_FOUND: 'ROLLUP_EXECUTION_NOT_FOUND',
  MAX_NODES_EXCEEDED: 'ROLLUP_MAX_NODES_EXCEEDED',
  MAX_REPOSITORIES_EXCEEDED: 'ROLLUP_MAX_REPOSITORIES_EXCEEDED',
  RATE_LIMITED: 'ROLLUP_RATE_LIMITED',
  PERMISSION_DENIED: 'ROLLUP_PERMISSION_DENIED',
  REPOSITORY_ACCESS_DENIED: 'ROLLUP_REPOSITORY_ACCESS_DENIED',
} as const;
```

---

## 3. Event Subscriptions (WebSocket/SSE)

The rollup system emits events for real-time updates. Frontend should subscribe to these events for live execution tracking.

### Event Types

```typescript
// ============================================================================
// Event Types for Real-Time Updates
// ============================================================================

export type RollupEventType =
  // Configuration lifecycle
  | 'rollup.created'
  | 'rollup.updated'
  | 'rollup.deleted'
  | 'rollup.archived'
  | 'rollup.activated'
  // Execution lifecycle
  | 'rollup.execution.started'
  | 'rollup.execution.progress'
  | 'rollup.execution.completed'
  | 'rollup.execution.failed'
  | 'rollup.execution.cancelled'
  // Matching events
  | 'rollup.matching.started'
  | 'rollup.matching.completed'
  // Merge events
  | 'rollup.merge.started'
  | 'rollup.merge.completed'
  | 'rollup.merge.conflict'
  // Blast radius events
  | 'rollup.blast_radius.calculated';

// Base event structure
export interface RollupEvent<T = unknown> {
  type: RollupEventType;
  eventId: string;
  tenantId: string;
  timestamp: string;
  version: number;
  payload: T;
  metadata: {
    correlationId?: string;
    triggeredBy?: string;
    source: 'api' | 'scheduler' | 'system' | 'webhook';
  };
}

// Key event payloads for UI updates
export interface ExecutionProgressPayload {
  rollupId: string;
  executionId: string;
  phase: 'loading' | 'matching' | 'merging' | 'storing';
  percentage: number;
  nodesProcessed: number;
  totalNodes: number;
  matchesFound: number;
  currentActivity: string;
  estimatedSecondsRemaining?: number;
}

export interface ExecutionCompletedPayload {
  rollupId: string;
  executionId: string;
  stats: RollupExecutionStats;
  mergedGraphId: string;
  durationMs: number;
}

export interface ExecutionFailedPayload {
  rollupId: string;
  executionId: string;
  errorCode: string;
  errorMessage: string;
  failedAt: 'loading' | 'matching' | 'merging' | 'storing';
  durationMs: number;
  willRetry: boolean;
}
```

### WebSocket Connection

```typescript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('wss://api.example.com/ws/rollups');

ws.onmessage = (event) => {
  const rollupEvent: RollupEvent = JSON.parse(event.data);

  switch (rollupEvent.type) {
    case 'rollup.execution.progress':
      handleExecutionProgress(rollupEvent.payload as ExecutionProgressPayload);
      break;
    case 'rollup.execution.completed':
      handleExecutionCompleted(rollupEvent.payload as ExecutionCompletedPayload);
      break;
    case 'rollup.execution.failed':
      handleExecutionFailed(rollupEvent.payload as ExecutionFailedPayload);
      break;
    // ... handle other events
  }
};

// Subscribe to specific rollup
ws.send(JSON.stringify({
  action: 'subscribe',
  rollupId: '<rollup-uuid>'
}));
```

### Server-Sent Events (Alternative)

```typescript
// Alternative SSE connection for execution updates
const eventSource = new EventSource(
  `https://api.example.com/api/v1/rollups/${rollupId}/executions/${executionId}/stream`,
  { withCredentials: true }
);

eventSource.addEventListener('progress', (event) => {
  const data: ExecutionProgressPayload = JSON.parse(event.data);
  updateProgressUI(data);
});

eventSource.addEventListener('completed', (event) => {
  const data: ExecutionCompletedPayload = JSON.parse(event.data);
  handleCompletion(data);
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  handleError(event);
});
```

---

## 4. React Query Integration

### Query Keys

```typescript
// ============================================================================
// React Query Key Factory
// ============================================================================

export const rollupKeys = {
  all: ['rollups'] as const,
  lists: () => [...rollupKeys.all, 'list'] as const,
  list: (query: RollupListQuery) => [...rollupKeys.lists(), query] as const,
  details: () => [...rollupKeys.all, 'detail'] as const,
  detail: (rollupId: string) => [...rollupKeys.details(), rollupId] as const,
  executions: (rollupId: string) =>
    [...rollupKeys.detail(rollupId), 'executions'] as const,
  execution: (rollupId: string, executionId: string) =>
    [...rollupKeys.executions(rollupId), executionId] as const,
  blastRadius: (rollupId: string, nodeIds: string[]) =>
    [...rollupKeys.detail(rollupId), 'blast-radius', nodeIds] as const,
  validation: () => [...rollupKeys.all, 'validation'] as const,
};
```

### Example Hooks

```typescript
// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// List rollups
export function useRollups(query: RollupListQuery = {}) {
  return useQuery({
    queryKey: rollupKeys.list(query),
    queryFn: () => apiClient.get<RollupPaginatedResponse>('/rollups', { params: query }),
    staleTime: 30_000,  // 30 seconds
  });
}

// Get single rollup
export function useRollup(rollupId: string) {
  return useQuery({
    queryKey: rollupKeys.detail(rollupId),
    queryFn: () => apiClient.get<RollupSingleResponse>(`/rollups/${rollupId}`),
    enabled: !!rollupId,
  });
}

// Get execution result with polling for pending/running
export function useExecutionResult(rollupId: string, executionId: string) {
  return useQuery({
    queryKey: rollupKeys.execution(rollupId, executionId),
    queryFn: () => apiClient.get<ExecutionResultResponse>(
      `/rollups/${rollupId}/executions/${executionId}`
    ),
    enabled: !!executionId,
    refetchInterval: (data) => {
      // Poll every 2 seconds while execution is in progress
      const status = data?.data?.status;
      return status === 'pending' || status === 'running' ? 2000 : false;
    },
  });
}

// Create rollup mutation
export function useCreateRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RollupCreateRequest) =>
      apiClient.post<RollupSingleResponse>('/rollups', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rollupKeys.lists() });
    },
  });
}

// Update rollup mutation
export function useUpdateRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rollupId, ...input }: RollupUpdateRequest & { rollupId: string }) =>
      apiClient.patch<RollupSingleResponse>(`/rollups/${rollupId}`, input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(rollupKeys.detail(variables.rollupId), data);
      queryClient.invalidateQueries({ queryKey: rollupKeys.lists() });
    },
  });
}

// Delete rollup mutation
export function useDeleteRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rollupId: string) => apiClient.delete(`/rollups/${rollupId}`),
    onSuccess: (_, rollupId) => {
      queryClient.removeQueries({ queryKey: rollupKeys.detail(rollupId) });
      queryClient.invalidateQueries({ queryKey: rollupKeys.lists() });
    },
  });
}

// Execute rollup mutation
export function useExecuteRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rollupId, ...input }: RollupExecuteRequest & { rollupId: string }) =>
      apiClient.post<ExecutionResultResponse>(`/rollups/${rollupId}/execute`, input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: rollupKeys.executions(variables.rollupId)
      });
      queryClient.invalidateQueries({
        queryKey: rollupKeys.detail(variables.rollupId)
      });
    },
  });
}

// Blast radius mutation
export function useBlastRadius(rollupId: string) {
  return useMutation({
    mutationFn: (query: BlastRadiusQuery) =>
      apiClient.post<BlastRadiusResultResponse>(
        `/rollups/${rollupId}/blast-radius`,
        query
      ),
  });
}

// Validate configuration mutation
export function useValidateRollup() {
  return useMutation({
    mutationFn: (input: RollupCreateRequest) =>
      apiClient.post<ValidationResponse>('/rollups/validate', input),
  });
}
```

---

## 5. UI Component Recommendations

### Suggested Component Structure

```
components/
  rollups/
    RollupList/
      RollupList.tsx           # Main list view
      RollupListItem.tsx       # Individual rollup card
      RollupFilters.tsx        # Filter controls
      RollupSearch.tsx         # Search input

    RollupDetail/
      RollupDetail.tsx         # Full rollup view
      RollupHeader.tsx         # Name, status, actions
      RollupRepositories.tsx   # Repository list
      RollupMatchers.tsx       # Matcher configuration display
      RollupSchedule.tsx       # Schedule display

    RollupForm/
      RollupForm.tsx           # Create/edit form
      MatcherBuilder.tsx       # Matcher configuration UI
      RepositorySelector.tsx   # Multi-select repositories
      ScheduleEditor.tsx       # Cron schedule editor

    RollupExecution/
      ExecutionProgress.tsx    # Real-time progress bar
      ExecutionStats.tsx       # Statistics display
      ExecutionHistory.tsx     # Past executions list
      MatchResultsTable.tsx    # Match details table

    RollupVisualization/
      MergedGraphView.tsx      # D3/React Flow graph
      CrossRepoEdges.tsx       # Cross-repo edge highlights
      NodeMergePreview.tsx     # Before/after merge preview

    BlastRadius/
      BlastRadiusPanel.tsx     # Main analysis panel
      ImpactTree.tsx           # Tree view of impacts
      RiskIndicator.tsx        # Risk level badge
      CrossRepoImpact.tsx      # Cross-repo impact display
```

### Key UI Components

#### 1. Matcher Builder Component

```typescript
// Component for configuring matching strategies
interface MatcherBuilderProps {
  value: MatcherConfig[];
  onChange: (matchers: MatcherConfig[]) => void;
  availableStrategies: MatchingStrategy[];
}

// Features needed:
// - Add/remove matchers
// - Drag-and-drop reordering (priority)
// - Strategy-specific configuration forms
// - Validation feedback
// - Preview of what each matcher will match
```

#### 2. Execution Progress Component

```typescript
interface ExecutionProgressProps {
  executionId: string;
  rollupId: string;
  onComplete?: (result: RollupExecutionResult) => void;
}

// Features needed:
// - Real-time progress bar with percentage
// - Phase indicator (loading/matching/merging/storing)
// - Nodes processed counter
// - Matches found counter
// - Estimated time remaining
// - Cancel button
// - Error display on failure
```

#### 3. Merged Graph Visualization

```typescript
interface MergedGraphViewProps {
  executionId: string;
  mergedNodes: MergedNode[];
  edges: GraphEdge[];
  highlightNodeId?: string;
  onNodeClick?: (node: MergedNode) => void;
}

// Features needed:
// - Interactive graph visualization (React Flow or D3)
// - Color coding by source repository
// - Highlight merged nodes vs unmatched
// - Show cross-repo edges differently
// - Zoom/pan controls
// - Node details on hover/click
// - Export as image/SVG
```

#### 4. Blast Radius Analysis

```typescript
interface BlastRadiusPanelProps {
  rollupId: string;
  selectedNodeIds: string[];
}

// Features needed:
// - Interactive node selection
// - Depth slider (1-20)
// - Risk level indicator with color
// - Impact breakdown by type/repo
// - Expandable tree view of impacts
// - Export impact report
```

---

## 6. State Management Recommendations

### Zustand Store for Rollup UI State

```typescript
// stores/rollup.store.ts
import { create } from 'zustand';
import { RollupConfig, MergedNode, MatcherConfig } from '@/types/rollup';

interface RollupUIState {
  // Form state
  formDraft: Partial<RollupConfig> | null;
  setFormDraft: (draft: Partial<RollupConfig> | null) => void;

  // Matcher builder state
  currentMatcher: MatcherConfig | null;
  setCurrentMatcher: (matcher: MatcherConfig | null) => void;

  // Visualization state
  selectedNodes: string[];
  selectNode: (nodeId: string) => void;
  deselectNode: (nodeId: string) => void;
  clearSelection: () => void;

  // Execution tracking
  activeExecutionId: string | null;
  setActiveExecutionId: (id: string | null) => void;

  // Graph view state
  graphLayout: 'force' | 'hierarchical' | 'radial';
  setGraphLayout: (layout: 'force' | 'hierarchical' | 'radial') => void;
  highlightCrossRepo: boolean;
  setHighlightCrossRepo: (highlight: boolean) => void;

  // Filters
  visibleNodeTypes: string[];
  setVisibleNodeTypes: (types: string[]) => void;
  visibleRepoIds: string[];
  setVisibleRepoIds: (ids: string[]) => void;
}

export const useRollupUIStore = create<RollupUIState>((set) => ({
  formDraft: null,
  setFormDraft: (draft) => set({ formDraft: draft }),

  currentMatcher: null,
  setCurrentMatcher: (matcher) => set({ currentMatcher: matcher }),

  selectedNodes: [],
  selectNode: (nodeId) => set((state) => ({
    selectedNodes: [...state.selectedNodes, nodeId]
  })),
  deselectNode: (nodeId) => set((state) => ({
    selectedNodes: state.selectedNodes.filter(id => id !== nodeId)
  })),
  clearSelection: () => set({ selectedNodes: [] }),

  activeExecutionId: null,
  setActiveExecutionId: (id) => set({ activeExecutionId: id }),

  graphLayout: 'force',
  setGraphLayout: (layout) => set({ graphLayout: layout }),
  highlightCrossRepo: true,
  setHighlightCrossRepo: (highlight) => set({ highlightCrossRepo: highlight }),

  visibleNodeTypes: [],
  setVisibleNodeTypes: (types) => set({ visibleNodeTypes: types }),
  visibleRepoIds: [],
  setVisibleRepoIds: (ids) => set({ visibleRepoIds: ids }),
}));
```

---

## 7. API Client Configuration

```typescript
// lib/api/rollup-client.ts
import { apiClient } from './client';
import type {
  RollupConfig,
  RollupCreateRequest,
  RollupUpdateRequest,
  RollupExecuteRequest,
  RollupListQuery,
  BlastRadiusQuery,
  RollupSingleResponse,
  RollupPaginatedResponse,
  ExecutionResultResponse,
  BlastRadiusResultResponse,
  ValidationResponse,
} from '@/types/rollup';

export const rollupApi = {
  // List rollups with pagination and filters
  list: (query?: RollupListQuery) =>
    apiClient.get<RollupPaginatedResponse>('/rollups', { params: query }),

  // Get single rollup
  get: (rollupId: string) =>
    apiClient.get<RollupSingleResponse>(`/rollups/${rollupId}`),

  // Create new rollup
  create: (input: RollupCreateRequest) =>
    apiClient.post<RollupSingleResponse>('/rollups', input),

  // Update rollup
  update: (rollupId: string, input: RollupUpdateRequest) =>
    apiClient.patch<RollupSingleResponse>(`/rollups/${rollupId}`, input),

  // Delete rollup
  delete: (rollupId: string) =>
    apiClient.delete(`/rollups/${rollupId}`),

  // Execute rollup
  execute: (rollupId: string, input: RollupExecuteRequest) =>
    apiClient.post<ExecutionResultResponse>(`/rollups/${rollupId}/execute`, input),

  // Get execution result
  getExecution: (rollupId: string, executionId: string) =>
    apiClient.get<ExecutionResultResponse>(
      `/rollups/${rollupId}/executions/${executionId}`
    ),

  // Compute blast radius
  blastRadius: (rollupId: string, query: BlastRadiusQuery) =>
    apiClient.post<BlastRadiusResultResponse>(
      `/rollups/${rollupId}/blast-radius`,
      query
    ),

  // Validate configuration
  validate: (input: RollupCreateRequest) =>
    apiClient.post<ValidationResponse>('/rollups/validate', input),
};
```

---

## 8. Related UI Tasks

This backend feature (TASK-ROLLUP-001) provides the API foundation for these UI tasks:

| Task ID | Name | Rollup Integration |
|---------|------|-------------------|
| TASK-UI-001 | React Project Setup | Configure rollup API client |
| TASK-UI-002 | Dashboard Screen | Show rollup status summary widget |
| TASK-UI-003 | Repository List | Add "Add to Rollup" action |
| TASK-UI-004 | Graph Visualization | Display merged rollup graph, cross-repo edges |
| TASK-UI-005 | Scan History Timeline | Show rollup executions in timeline |

---

## 9. Testing Recommendations

### Integration Test Points

```typescript
// Tests frontend team should implement:

describe('Rollup API Integration', () => {
  it('should create rollup with minimum 2 repositories');
  it('should validate matcher configuration before save');
  it('should poll execution status until completion');
  it('should handle execution failures gracefully');
  it('should compute blast radius for selected nodes');
  it('should handle rate limiting with retry logic');
  it('should maintain optimistic locking on updates');
});

describe('Real-time Updates', () => {
  it('should receive progress events during execution');
  it('should update UI on execution completion');
  it('should reconnect WebSocket on disconnection');
});

describe('Visualization', () => {
  it('should render merged graph with cross-repo edges');
  it('should highlight nodes from different repositories');
  it('should show blast radius impact tree');
});
```

---

## 10. Service Limits

Frontend should enforce these limits client-side:

| Limit | Value |
|-------|-------|
| Maximum repositories per rollup | 10 |
| Maximum matchers per rollup | 20 |
| Maximum nodes in merged result | 50,000 |
| Default execution timeout | 300 seconds |
| Maximum execution timeout | 3,600 seconds |
| Maximum concurrent executions per tenant | 5 |
| Maximum blast radius depth | 20 |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-28 | Agent #25 | Initial document |

---

## For Downstream Agents

**For Test Generator (Agent 029):**
- Test rollup CRUD operations via API
- Test execution polling and timeout handling
- Test WebSocket event subscriptions
- Test validation error handling
- Test rate limiting behavior

**For Error Handler Implementer (Agent 026):**
- Handle all error codes in `RollupErrorCodes`
- Implement retry logic for `RATE_LIMITED` errors
- Show user-friendly messages for validation errors
- Handle WebSocket disconnection gracefully
