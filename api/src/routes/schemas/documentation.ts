/**
 * Documentation System API Schemas
 * @module routes/schemas/documentation
 *
 * TypeBox schemas for documentation system API request/response validation.
 * Supports TASK-FINAL-004: Documentation, Beta Onboarding, and Launch Readiness.
 */

import { Type, Static } from '@sinclair/typebox';
import {
  PaginationInfoSchema,
  SortOrderSchema,
} from './common.js';
import {
  DocPageSchema,
  DocPageSummarySchema,
  DocPageCategorySchema,
  DocPageStatusSchema,
  DocTableOfContentsSchema,
  BetaCustomerSchema,
  BetaCustomerSummarySchema,
  BetaCustomerTierSchema,
  OnboardingStatusSchema,
  BetaCustomerStatsSchema,
  LaunchChecklistSchema,
  ChecklistItemSchema,
  ChecklistCategorySchema,
  ChecklistPrioritySchema,
  LaunchReadinessSummarySchema,
  ChecklistProgressByCategorySchema,
} from '../../types/documentation.js';

// ============================================================================
// Documentation Page Schemas
// ============================================================================

/**
 * Create documentation page request
 */
export const CreateDocPageRequestSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200, description: 'Page title' }),
  content: Type.Optional(Type.String({ description: 'Page content in markdown' })),
  category: DocPageCategorySchema,
  slug: Type.Optional(Type.String({ pattern: '^[a-z0-9-]+$', description: 'URL-friendly slug' })),
  status: Type.Optional(DocPageStatusSchema),
  order: Type.Optional(Type.Number({ minimum: 0, description: 'Display order' })),
  parentId: Type.Optional(Type.String({ description: 'Parent page ID' })),
  tags: Type.Optional(Type.Array(Type.String(), { description: 'Searchable tags' })),
  author: Type.Optional(Type.String({ description: 'Author name' })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type CreateDocPageRequest = Static<typeof CreateDocPageRequestSchema>;

/**
 * Update documentation page request
 */
export const UpdateDocPageRequestSchema = Type.Partial(Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  content: Type.String(),
  category: DocPageCategorySchema,
  status: DocPageStatusSchema,
  order: Type.Number({ minimum: 0 }),
  parentId: Type.Union([Type.String(), Type.Null()]),
  tags: Type.Array(Type.String()),
  author: Type.String(),
  metadata: Type.Record(Type.String(), Type.Unknown()),
}));

export type UpdateDocPageRequest = Static<typeof UpdateDocPageRequestSchema>;

/**
 * List documentation pages query
 */
export const ListDocPagesQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  category: Type.Optional(DocPageCategorySchema),
  status: Type.Optional(DocPageStatusSchema),
  parentId: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  search: Type.Optional(Type.String({ maxLength: 200 })),
  sortBy: Type.Optional(Type.Union([
    Type.Literal('title'),
    Type.Literal('lastUpdated'),
    Type.Literal('createdAt'),
    Type.Literal('order'),
  ])),
  sortOrder: Type.Optional(SortOrderSchema),
});

export type ListDocPagesQuery = Static<typeof ListDocPagesQuerySchema>;

/**
 * Documentation page response
 */
export const DocPageResponseSchema = DocPageSchema;

export type DocPageResponse = Static<typeof DocPageResponseSchema>;

/**
 * Documentation page list response
 */
export const DocPageListResponseSchema = Type.Object({
  data: Type.Array(DocPageSummarySchema),
  pagination: PaginationInfoSchema,
});

export type DocPageListResponse = Static<typeof DocPageListResponseSchema>;

/**
 * Publish page request
 */
export const PublishPageRequestSchema = Type.Object({
  publishedBy: Type.String({ description: 'User who is publishing the page' }),
});

export type PublishPageRequest = Static<typeof PublishPageRequestSchema>;

/**
 * Reorder pages request
 */
export const ReorderPagesRequestSchema = Type.Object({
  category: DocPageCategorySchema,
  pageIds: Type.Array(Type.String(), { minItems: 1, description: 'Ordered list of page IDs' }),
});

export type ReorderPagesRequest = Static<typeof ReorderPagesRequestSchema>;

// ============================================================================
// Beta Customer Schemas
// ============================================================================

/**
 * Register beta customer request
 */
export const RegisterBetaCustomerRequestSchema = Type.Object({
  companyName: Type.String({ minLength: 1, maxLength: 200, description: 'Company name' }),
  contactEmail: Type.String({ format: 'email', description: 'Primary contact email' }),
  contactName: Type.Optional(Type.String({ maxLength: 200, description: 'Primary contact name' })),
  tier: Type.Optional(BetaCustomerTierSchema),
  notes: Type.Optional(Type.String({ maxLength: 2000, description: 'Internal notes' })),
});

export type RegisterBetaCustomerRequest = Static<typeof RegisterBetaCustomerRequestSchema>;

/**
 * Update beta customer request
 */
export const UpdateBetaCustomerRequestSchema = Type.Partial(Type.Object({
  companyName: Type.String({ minLength: 1, maxLength: 200 }),
  contactEmail: Type.String({ format: 'email' }),
  contactName: Type.String({ maxLength: 200 }),
  tier: BetaCustomerTierSchema,
  notes: Type.String({ maxLength: 2000 }),
}));

export type UpdateBetaCustomerRequest = Static<typeof UpdateBetaCustomerRequestSchema>;

/**
 * List beta customers query
 */
export const ListBetaCustomersQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  status: Type.Optional(OnboardingStatusSchema),
  tier: Type.Optional(BetaCustomerTierSchema),
  ndaSigned: Type.Optional(Type.Boolean()),
  search: Type.Optional(Type.String({ maxLength: 200 })),
  activeInLast30Days: Type.Optional(Type.Boolean()),
  sortBy: Type.Optional(Type.Union([
    Type.Literal('companyName'),
    Type.Literal('createdAt'),
    Type.Literal('lastActiveAt'),
    Type.Literal('feedbackCount'),
  ])),
  sortOrder: Type.Optional(SortOrderSchema),
});

export type ListBetaCustomersQuery = Static<typeof ListBetaCustomersQuerySchema>;

/**
 * Beta customer response
 */
export const BetaCustomerResponseSchema = BetaCustomerSchema;

export type BetaCustomerResponse = Static<typeof BetaCustomerResponseSchema>;

/**
 * Beta customer list response
 */
export const BetaCustomerListResponseSchema = Type.Object({
  data: Type.Array(BetaCustomerSummarySchema),
  pagination: PaginationInfoSchema,
});

export type BetaCustomerListResponse = Static<typeof BetaCustomerListResponseSchema>;

/**
 * NDA signature response
 */
export const NDASignatureResponseSchema = Type.Object({
  customerId: Type.String({ format: 'uuid' }),
  signedAt: Type.String({ format: 'date-time' }),
  processedBy: Type.Optional(Type.String()),
});

export type NDASignatureResponse = Static<typeof NDASignatureResponseSchema>;

/**
 * NDA sign request
 */
export const SignNDARequestSchema = Type.Object({
  processedBy: Type.Optional(Type.String({ description: 'Admin who processed the signature' })),
});

export type SignNDARequest = Static<typeof SignNDARequestSchema>;

/**
 * NDA revoke request
 */
export const RevokeNDARequestSchema = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 500, description: 'Reason for revoking NDA' }),
});

export type RevokeNDARequest = Static<typeof RevokeNDARequestSchema>;

/**
 * Onboarding progress event response
 */
export const OnboardingProgressResponseSchema = Type.Object({
  customerId: Type.String({ format: 'uuid' }),
  previousStatus: OnboardingStatusSchema,
  newStatus: OnboardingStatusSchema,
  timestamp: Type.String({ format: 'date-time' }),
});

export type OnboardingProgressResponse = Static<typeof OnboardingProgressResponseSchema>;

/**
 * Mark as churned request
 */
export const MarkAsChurnedRequestSchema = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 500, description: 'Reason for churn' }),
});

export type MarkAsChurnedRequest = Static<typeof MarkAsChurnedRequestSchema>;

/**
 * Beta customer statistics response
 */
export const BetaCustomerStatsResponseSchema = BetaCustomerStatsSchema;

export type BetaCustomerStatsResponse = Static<typeof BetaCustomerStatsResponseSchema>;

// ============================================================================
// Launch Checklist Schemas
// ============================================================================

/**
 * Create checklist item request
 */
export const CreateChecklistItemRequestSchema = Type.Object({
  category: ChecklistCategorySchema,
  description: Type.String({ minLength: 1, maxLength: 500, description: 'Item description' }),
  priority: Type.Optional(ChecklistPrioritySchema),
  dueDate: Type.Optional(Type.String({ format: 'date-time', description: 'Target completion date' })),
  assignee: Type.Optional(Type.String({ description: 'Assigned user or team' })),
  blockedBy: Type.Optional(Type.Array(Type.String(), { description: 'IDs of blocking items' })),
});

export type CreateChecklistItemRequest = Static<typeof CreateChecklistItemRequestSchema>;

/**
 * Update checklist item request
 */
export const UpdateChecklistItemRequestSchema = Type.Partial(Type.Object({
  description: Type.String({ minLength: 1, maxLength: 500 }),
  priority: ChecklistPrioritySchema,
  dueDate: Type.String({ format: 'date-time' }),
  assignee: Type.String(),
  notes: Type.String({ maxLength: 2000 }),
  blockedBy: Type.Array(Type.String()),
}));

export type UpdateChecklistItemRequest = Static<typeof UpdateChecklistItemRequestSchema>;

/**
 * Complete checklist item request
 */
export const CompleteChecklistItemRequestSchema = Type.Object({
  completedBy: Type.Optional(Type.String({ description: 'User who completed the item' })),
  evidence: Type.Optional(Type.String({ maxLength: 2000, description: 'Evidence or link to proof' })),
});

export type CompleteChecklistItemRequest = Static<typeof CompleteChecklistItemRequestSchema>;

/**
 * List checklist items query
 */
export const ListChecklistItemsQuerySchema = Type.Object({
  category: Type.Optional(ChecklistCategorySchema),
  priority: Type.Optional(ChecklistPrioritySchema),
  completed: Type.Optional(Type.Boolean()),
  overdue: Type.Optional(Type.Boolean()),
  blocked: Type.Optional(Type.Boolean()),
  assignee: Type.Optional(Type.String()),
});

export type ListChecklistItemsQuery = Static<typeof ListChecklistItemsQuerySchema>;

/**
 * Checklist item response
 */
export const ChecklistItemResponseSchema = ChecklistItemSchema;

export type ChecklistItemResponse = Static<typeof ChecklistItemResponseSchema>;

/**
 * Checklist item list response
 */
export const ChecklistItemListResponseSchema = Type.Object({
  data: Type.Array(ChecklistItemSchema),
});

export type ChecklistItemListResponse = Static<typeof ChecklistItemListResponseSchema>;

/**
 * Launch checklist response
 */
export const LaunchChecklistResponseSchema = LaunchChecklistSchema;

export type LaunchChecklistResponse = Static<typeof LaunchChecklistResponseSchema>;

/**
 * Set target launch date request
 */
export const SetTargetLaunchDateRequestSchema = Type.Object({
  targetLaunchDate: Type.String({ format: 'date-time', description: 'Target launch date' }),
});

export type SetTargetLaunchDateRequest = Static<typeof SetTargetLaunchDateRequestSchema>;

/**
 * Add blocker request
 */
export const AddBlockerRequestSchema = Type.Object({
  blockerId: Type.String({ description: 'ID of the blocking item' }),
});

export type AddBlockerRequest = Static<typeof AddBlockerRequestSchema>;

/**
 * Bulk complete items request
 */
export const BulkCompleteItemsRequestSchema = Type.Object({
  itemIds: Type.Array(Type.String(), { minItems: 1, description: 'Item IDs to complete' }),
  completedBy: Type.Optional(Type.String()),
  evidence: Type.Optional(Type.String()),
});

export type BulkCompleteItemsRequest = Static<typeof BulkCompleteItemsRequestSchema>;

/**
 * Bulk assign items request
 */
export const BulkAssignItemsRequestSchema = Type.Object({
  itemIds: Type.Array(Type.String(), { minItems: 1, description: 'Item IDs to assign' }),
  assignee: Type.String({ description: 'Assignee name' }),
});

export type BulkAssignItemsRequest = Static<typeof BulkAssignItemsRequestSchema>;

/**
 * Bulk operation response
 */
export const BulkOperationResponseSchema = Type.Object({
  successful: Type.Array(Type.String()),
  failed: Type.Array(Type.Object({
    id: Type.String(),
    error: Type.Object({
      code: Type.String(),
      message: Type.String(),
    }),
  })),
});

export type BulkOperationResponse = Static<typeof BulkOperationResponseSchema>;

/**
 * Launch readiness summary response
 */
export const LaunchReadinessSummaryResponseSchema = LaunchReadinessSummarySchema;

export type LaunchReadinessSummaryResponse = Static<typeof LaunchReadinessSummaryResponseSchema>;

/**
 * Launch readiness assessment response
 */
export const LaunchReadinessAssessmentResponseSchema = Type.Object({
  readyForLaunch: Type.Boolean(),
  overallProgress: Type.Number({ minimum: 0, maximum: 100 }),
  blockers: Type.Array(Type.Object({
    itemId: Type.String(),
    description: Type.String(),
    category: ChecklistCategorySchema,
    priority: Type.Optional(ChecklistPrioritySchema),
    blockedBy: Type.Optional(Type.Array(Type.String())),
    assignee: Type.Optional(Type.String()),
    dueDate: Type.Optional(Type.String({ format: 'date-time' })),
  })),
  criticalItemsRemaining: Type.Number(),
  overdueItemsCount: Type.Number(),
  estimatedCompletionDate: Type.Optional(Type.String({ format: 'date-time' })),
  progressByCategory: Type.Array(ChecklistProgressByCategorySchema),
  recommendations: Type.Array(Type.String()),
});

export type LaunchReadinessAssessmentResponse = Static<typeof LaunchReadinessAssessmentResponseSchema>;

/**
 * Progress by category response
 */
export const ProgressByCategoryResponseSchema = Type.Object({
  data: Type.Array(ChecklistProgressByCategorySchema),
});

export type ProgressByCategoryResponse = Static<typeof ProgressByCategoryResponseSchema>;

// ============================================================================
// Common Documentation Schemas
// ============================================================================

/**
 * Service error response
 */
export const ServiceErrorResponseSchema = Type.Object({
  error: Type.String({ description: 'Error message' }),
  code: Type.Optional(Type.String({ description: 'Error code' })),
  context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type ServiceErrorResponse = Static<typeof ServiceErrorResponseSchema>;

/**
 * ID parameter schema
 */
export const IdParamSchema = Type.Object({
  id: Type.String({ description: 'Resource ID' }),
});

export type IdParam = Static<typeof IdParamSchema>;

/**
 * Item ID parameter schema
 */
export const ItemIdParamSchema = Type.Object({
  itemId: Type.String({ description: 'Checklist item ID' }),
});

export type ItemIdParam = Static<typeof ItemIdParamSchema>;
