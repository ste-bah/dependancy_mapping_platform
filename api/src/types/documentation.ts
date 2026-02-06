/**
 * Documentation System Type Definitions
 * @module types/documentation
 *
 * Type definitions for the documentation system, beta customer management,
 * and launch readiness tracking. Supports TASK-FINAL-004 deliverables.
 *
 * All schemas use TypeBox for OpenAPI/JSON Schema compatibility.
 */

import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// OpenAPI Metadata Types
// ============================================================================

/**
 * OpenAPI contact information
 */
export const OpenAPIContactSchema = Type.Object({
  name: Type.Optional(Type.String({ description: 'Contact name' })),
  url: Type.Optional(Type.String({ format: 'uri', description: 'Contact URL' })),
  email: Type.Optional(Type.String({ format: 'email', description: 'Contact email' })),
});

export type OpenAPIContact = Static<typeof OpenAPIContactSchema>;

/**
 * OpenAPI license information
 */
export const OpenAPILicenseSchema = Type.Object({
  name: Type.String({ description: 'License name' }),
  url: Type.Optional(Type.String({ format: 'uri', description: 'License URL' })),
});

export type OpenAPILicense = Static<typeof OpenAPILicenseSchema>;

/**
 * OpenAPI info object schema
 */
export const OpenAPIInfoSchema = Type.Object({
  title: Type.String({ description: 'API title' }),
  version: Type.String({ description: 'API version (semver)' }),
  description: Type.Optional(Type.String({ description: 'API description (markdown supported)' })),
  termsOfService: Type.Optional(Type.String({ format: 'uri', description: 'Terms of service URL' })),
  contact: Type.Optional(OpenAPIContactSchema),
  license: Type.Optional(OpenAPILicenseSchema),
});

export type OpenAPIInfo = Static<typeof OpenAPIInfoSchema>;

/**
 * OpenAPI server object
 */
export const OpenAPIServerSchema = Type.Object({
  url: Type.String({ description: 'Server URL' }),
  description: Type.Optional(Type.String({ description: 'Server description' })),
  variables: Type.Optional(Type.Record(Type.String(), Type.Object({
    default: Type.String(),
    enum: Type.Optional(Type.Array(Type.String())),
    description: Type.Optional(Type.String()),
  }))),
});

export type OpenAPIServer = Static<typeof OpenAPIServerSchema>;

/**
 * OpenAPI external documentation
 */
export const OpenAPIExternalDocsSchema = Type.Object({
  url: Type.String({ format: 'uri', description: 'External documentation URL' }),
  description: Type.Optional(Type.String({ description: 'Description of external docs' })),
});

export type OpenAPIExternalDocs = Static<typeof OpenAPIExternalDocsSchema>;

// ============================================================================
// Documentation Page Types
// ============================================================================

/**
 * Documentation page category enum
 */
export const DocPageCategory = {
  USER_GUIDE: 'user-guide',
  API_REFERENCE: 'api-reference',
  INTEGRATION: 'integration',
  SUPPORT: 'support',
  GETTING_STARTED: 'getting-started',
  TUTORIALS: 'tutorials',
  TROUBLESHOOTING: 'troubleshooting',
  RELEASE_NOTES: 'release-notes',
} as const;

export type DocPageCategory = typeof DocPageCategory[keyof typeof DocPageCategory];

/**
 * Documentation page category schema
 */
export const DocPageCategorySchema = Type.Union([
  Type.Literal('user-guide'),
  Type.Literal('api-reference'),
  Type.Literal('integration'),
  Type.Literal('support'),
  Type.Literal('getting-started'),
  Type.Literal('tutorials'),
  Type.Literal('troubleshooting'),
  Type.Literal('release-notes'),
]);

/**
 * Documentation page status
 */
export const DocPageStatus = {
  DRAFT: 'draft',
  REVIEW: 'review',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type DocPageStatus = typeof DocPageStatus[keyof typeof DocPageStatus];

/**
 * Documentation page status schema
 */
export const DocPageStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('review'),
  Type.Literal('published'),
  Type.Literal('archived'),
]);

/**
 * Documentation page schema
 */
export const DocPageSchema = Type.Object({
  id: Type.String({ description: 'Unique page identifier' }),
  title: Type.String({ minLength: 1, maxLength: 200, description: 'Page title' }),
  slug: Type.String({ pattern: '^[a-z0-9-]+$', description: 'URL-friendly slug' }),
  content: Type.String({ description: 'Page content in markdown format' }),
  category: DocPageCategorySchema,
  status: Type.Optional(DocPageStatusSchema),
  order: Type.Optional(Type.Number({ minimum: 0, description: 'Display order within category' })),
  parentId: Type.Optional(Type.String({ description: 'Parent page ID for nested pages' })),
  tags: Type.Optional(Type.Array(Type.String(), { description: 'Searchable tags' })),
  author: Type.Optional(Type.String({ description: 'Author name or ID' })),
  lastUpdated: Type.String({ format: 'date-time', description: 'Last modification timestamp' }),
  createdAt: Type.Optional(Type.String({ format: 'date-time', description: 'Creation timestamp' })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: 'Additional metadata' })),
});

export type DocPage = Static<typeof DocPageSchema>;

/**
 * Documentation page summary (for listings)
 */
export const DocPageSummarySchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  category: DocPageCategorySchema,
  status: Type.Optional(DocPageStatusSchema),
  order: Type.Optional(Type.Number()),
  lastUpdated: Type.String({ format: 'date-time' }),
});

export type DocPageSummary = Static<typeof DocPageSummarySchema>;

/**
 * Documentation navigation item
 */
export const DocNavItemSchema = Type.Recursive(
  (Self) =>
    Type.Object({
      id: Type.String(),
      title: Type.String(),
      slug: Type.String(),
      order: Type.Number(),
      children: Type.Optional(Type.Array(Self)),
    }),
  { $id: 'DocNavItem' }
);

export type DocNavItem = Static<typeof DocNavItemSchema>;

/**
 * Documentation table of contents
 */
export const DocTableOfContentsSchema = Type.Object({
  categories: Type.Array(Type.Object({
    category: DocPageCategorySchema,
    label: Type.String(),
    items: Type.Array(DocNavItemSchema),
  })),
  lastUpdated: Type.String({ format: 'date-time' }),
});

export type DocTableOfContents = Static<typeof DocTableOfContentsSchema>;

// ============================================================================
// Beta Customer Types
// ============================================================================

/**
 * Beta customer onboarding status
 */
export const OnboardingStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CHURNED: 'churned',
} as const;

export type OnboardingStatus = typeof OnboardingStatus[keyof typeof OnboardingStatus];

/**
 * Onboarding status schema
 */
export const OnboardingStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('in-progress'),
  Type.Literal('completed'),
  Type.Literal('churned'),
]);

/**
 * Beta customer tier
 */
export const BetaCustomerTier = {
  DESIGN_PARTNER: 'design-partner',
  EARLY_ADOPTER: 'early-adopter',
  BETA_TESTER: 'beta-tester',
} as const;

export type BetaCustomerTier = typeof BetaCustomerTier[keyof typeof BetaCustomerTier];

/**
 * Beta customer tier schema
 */
export const BetaCustomerTierSchema = Type.Union([
  Type.Literal('design-partner'),
  Type.Literal('early-adopter'),
  Type.Literal('beta-tester'),
]);

/**
 * Beta customer schema
 */
export const BetaCustomerSchema = Type.Object({
  id: Type.String({ format: 'uuid', description: 'Unique customer identifier' }),
  companyName: Type.String({ minLength: 1, maxLength: 200, description: 'Company name' }),
  contactEmail: Type.String({ format: 'email', description: 'Primary contact email' }),
  contactName: Type.Optional(Type.String({ description: 'Primary contact name' })),
  ndaSigned: Type.Boolean({ description: 'Whether NDA has been signed' }),
  ndaSignedAt: Type.Optional(Type.String({ format: 'date-time', description: 'NDA signature timestamp' })),
  onboardingStatus: OnboardingStatusSchema,
  tier: Type.Optional(BetaCustomerTierSchema),
  notes: Type.Optional(Type.String({ description: 'Internal notes about the customer' })),
  feedbackCount: Type.Optional(Type.Number({ minimum: 0, description: 'Number of feedback items received' })),
  lastActiveAt: Type.Optional(Type.String({ format: 'date-time', description: 'Last activity timestamp' })),
  createdAt: Type.String({ format: 'date-time', description: 'Record creation timestamp' }),
  updatedAt: Type.Optional(Type.String({ format: 'date-time', description: 'Last update timestamp' })),
});

export type BetaCustomer = Static<typeof BetaCustomerSchema>;

/**
 * Beta customer summary (for listings)
 */
export const BetaCustomerSummarySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  companyName: Type.String(),
  contactEmail: Type.String({ format: 'email' }),
  ndaSigned: Type.Boolean(),
  onboardingStatus: OnboardingStatusSchema,
  tier: Type.Optional(BetaCustomerTierSchema),
  createdAt: Type.String({ format: 'date-time' }),
});

export type BetaCustomerSummary = Static<typeof BetaCustomerSummarySchema>;

/**
 * Beta customer creation request
 */
export const CreateBetaCustomerRequestSchema = Type.Object({
  companyName: Type.String({ minLength: 1, maxLength: 200 }),
  contactEmail: Type.String({ format: 'email' }),
  contactName: Type.Optional(Type.String()),
  tier: Type.Optional(BetaCustomerTierSchema),
  notes: Type.Optional(Type.String()),
});

export type CreateBetaCustomerRequest = Static<typeof CreateBetaCustomerRequestSchema>;

/**
 * Beta customer update request
 */
export const UpdateBetaCustomerRequestSchema = Type.Partial(Type.Object({
  companyName: Type.String({ minLength: 1, maxLength: 200 }),
  contactEmail: Type.String({ format: 'email' }),
  contactName: Type.String(),
  ndaSigned: Type.Boolean(),
  onboardingStatus: OnboardingStatusSchema,
  tier: BetaCustomerTierSchema,
  notes: Type.String(),
}));

export type UpdateBetaCustomerRequest = Static<typeof UpdateBetaCustomerRequestSchema>;

/**
 * Beta customer statistics
 */
export const BetaCustomerStatsSchema = Type.Object({
  total: Type.Number({ description: 'Total beta customers' }),
  byStatus: Type.Object({
    pending: Type.Number(),
    inProgress: Type.Number(),
    completed: Type.Number(),
    churned: Type.Number(),
  }),
  byTier: Type.Object({
    designPartner: Type.Number(),
    earlyAdopter: Type.Number(),
    betaTester: Type.Number(),
  }),
  ndaSignedCount: Type.Number({ description: 'Customers with signed NDAs' }),
  activeInLast30Days: Type.Number({ description: 'Customers active in last 30 days' }),
  averageFeedbackCount: Type.Number({ description: 'Average feedback items per customer' }),
});

export type BetaCustomerStats = Static<typeof BetaCustomerStatsSchema>;

// ============================================================================
// Launch Checklist Types
// ============================================================================

/**
 * Checklist item category
 */
export const ChecklistCategory = {
  INFRASTRUCTURE: 'infrastructure',
  SECURITY: 'security',
  DOCUMENTATION: 'documentation',
  TESTING: 'testing',
  COMPLIANCE: 'compliance',
  MARKETING: 'marketing',
  SUPPORT: 'support',
  LEGAL: 'legal',
} as const;

export type ChecklistCategory = typeof ChecklistCategory[keyof typeof ChecklistCategory];

/**
 * Checklist category schema
 */
export const ChecklistCategorySchema = Type.Union([
  Type.Literal('infrastructure'),
  Type.Literal('security'),
  Type.Literal('documentation'),
  Type.Literal('testing'),
  Type.Literal('compliance'),
  Type.Literal('marketing'),
  Type.Literal('support'),
  Type.Literal('legal'),
]);

/**
 * Checklist item priority
 */
export const ChecklistPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type ChecklistPriority = typeof ChecklistPriority[keyof typeof ChecklistPriority];

/**
 * Checklist priority schema
 */
export const ChecklistPrioritySchema = Type.Union([
  Type.Literal('critical'),
  Type.Literal('high'),
  Type.Literal('medium'),
  Type.Literal('low'),
]);

/**
 * Checklist item schema
 */
export const ChecklistItemSchema = Type.Object({
  id: Type.String({ description: 'Unique item identifier' }),
  category: ChecklistCategorySchema,
  description: Type.String({ minLength: 1, maxLength: 500, description: 'Item description' }),
  priority: Type.Optional(ChecklistPrioritySchema),
  completed: Type.Boolean({ description: 'Whether item is completed' }),
  completedBy: Type.Optional(Type.String({ description: 'User who completed the item' })),
  completedAt: Type.Optional(Type.String({ format: 'date-time', description: 'Completion timestamp' })),
  dueDate: Type.Optional(Type.String({ format: 'date-time', description: 'Target completion date' })),
  assignee: Type.Optional(Type.String({ description: 'Assigned user or team' })),
  notes: Type.Optional(Type.String({ description: 'Additional notes' })),
  blockedBy: Type.Optional(Type.Array(Type.String(), { description: 'IDs of blocking items' })),
  evidence: Type.Optional(Type.String({ description: 'Evidence or link to completion proof' })),
  createdAt: Type.Optional(Type.String({ format: 'date-time' })),
  updatedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type ChecklistItem = Static<typeof ChecklistItemSchema>;

/**
 * Launch checklist schema
 */
export const LaunchChecklistSchema = Type.Object({
  id: Type.Optional(Type.String({ description: 'Checklist identifier' })),
  name: Type.Optional(Type.String({ description: 'Checklist name' })),
  items: Type.Array(ChecklistItemSchema, { description: 'All checklist items' }),
  overallProgress: Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Overall completion percentage'
  }),
  readyForLaunch: Type.Boolean({ description: 'Whether all critical items are complete' }),
  targetLaunchDate: Type.Optional(Type.String({ format: 'date-time', description: 'Target launch date' })),
  lastUpdated: Type.Optional(Type.String({ format: 'date-time' })),
});

export type LaunchChecklist = Static<typeof LaunchChecklistSchema>;

/**
 * Checklist progress by category
 */
export const ChecklistProgressByCategorySchema = Type.Object({
  category: ChecklistCategorySchema,
  total: Type.Number(),
  completed: Type.Number(),
  percentage: Type.Number({ minimum: 0, maximum: 100 }),
  criticalRemaining: Type.Number({ description: 'Critical items not yet completed' }),
});

export type ChecklistProgressByCategory = Static<typeof ChecklistProgressByCategorySchema>;

/**
 * Launch readiness summary
 */
export const LaunchReadinessSummarySchema = Type.Object({
  readyForLaunch: Type.Boolean(),
  overallProgress: Type.Number({ minimum: 0, maximum: 100 }),
  totalItems: Type.Number(),
  completedItems: Type.Number(),
  criticalItems: Type.Number(),
  criticalCompleted: Type.Number(),
  blockedItems: Type.Number(),
  overdueItems: Type.Number(),
  progressByCategory: Type.Array(ChecklistProgressByCategorySchema),
  estimatedCompletionDate: Type.Optional(Type.String({ format: 'date-time' })),
  blockers: Type.Array(Type.Object({
    id: Type.String(),
    description: Type.String(),
    category: ChecklistCategorySchema,
    blockedBy: Type.Optional(Type.Array(Type.String())),
  })),
});

export type LaunchReadinessSummary = Static<typeof LaunchReadinessSummarySchema>;

/**
 * Checklist item update request
 */
export const UpdateChecklistItemRequestSchema = Type.Partial(Type.Object({
  description: Type.String({ minLength: 1, maxLength: 500 }),
  priority: ChecklistPrioritySchema,
  completed: Type.Boolean(),
  dueDate: Type.String({ format: 'date-time' }),
  assignee: Type.String(),
  notes: Type.String(),
  blockedBy: Type.Array(Type.String()),
  evidence: Type.String(),
}));

export type UpdateChecklistItemRequest = Static<typeof UpdateChecklistItemRequestSchema>;

/**
 * Create checklist item request
 */
export const CreateChecklistItemRequestSchema = Type.Object({
  category: ChecklistCategorySchema,
  description: Type.String({ minLength: 1, maxLength: 500 }),
  priority: Type.Optional(ChecklistPrioritySchema),
  dueDate: Type.Optional(Type.String({ format: 'date-time' })),
  assignee: Type.Optional(Type.String()),
  blockedBy: Type.Optional(Type.Array(Type.String())),
});

export type CreateChecklistItemRequest = Static<typeof CreateChecklistItemRequestSchema>;

// ============================================================================
// API Documentation Types
// ============================================================================

/**
 * API endpoint documentation
 */
export const ApiEndpointDocSchema = Type.Object({
  method: Type.Union([
    Type.Literal('GET'),
    Type.Literal('POST'),
    Type.Literal('PUT'),
    Type.Literal('PATCH'),
    Type.Literal('DELETE'),
  ]),
  path: Type.String({ description: 'API path with parameters' }),
  summary: Type.String({ description: 'Brief description' }),
  description: Type.Optional(Type.String({ description: 'Detailed description' })),
  tags: Type.Array(Type.String(), { description: 'OpenAPI tags' }),
  authentication: Type.Optional(Type.Union([
    Type.Literal('none'),
    Type.Literal('api-key'),
    Type.Literal('bearer'),
    Type.Literal('oauth2'),
  ])),
  deprecated: Type.Optional(Type.Boolean()),
  requestBody: Type.Optional(Type.Object({
    contentType: Type.String(),
    schema: Type.String({ description: 'Reference to schema' }),
    example: Type.Optional(Type.Unknown()),
  })),
  responses: Type.Record(Type.String(), Type.Object({
    description: Type.String(),
    schema: Type.Optional(Type.String()),
    example: Type.Optional(Type.Unknown()),
  })),
});

export type ApiEndpointDoc = Static<typeof ApiEndpointDocSchema>;

/**
 * API documentation section
 */
export const ApiDocSectionSchema = Type.Object({
  tag: Type.String({ description: 'OpenAPI tag name' }),
  name: Type.String({ description: 'Section display name' }),
  description: Type.String({ description: 'Section description' }),
  endpoints: Type.Array(ApiEndpointDocSchema),
});

export type ApiDocSection = Static<typeof ApiDocSectionSchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for DocPage
 */
export function isDocPage(value: unknown): value is DocPage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'slug' in value &&
    'content' in value &&
    'category' in value &&
    'lastUpdated' in value
  );
}

/**
 * Type guard for BetaCustomer
 */
export function isBetaCustomer(value: unknown): value is BetaCustomer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'companyName' in value &&
    'contactEmail' in value &&
    'ndaSigned' in value &&
    'onboardingStatus' in value &&
    'createdAt' in value
  );
}

/**
 * Type guard for ChecklistItem
 */
export function isChecklistItem(value: unknown): value is ChecklistItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'category' in value &&
    'description' in value &&
    'completed' in value
  );
}

/**
 * Type guard for LaunchChecklist
 */
export function isLaunchChecklist(value: unknown): value is LaunchChecklist {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray((value as LaunchChecklist).items) &&
    'overallProgress' in value &&
    'readyForLaunch' in value
  );
}

/**
 * Type guard for valid DocPageCategory
 */
export function isDocPageCategory(value: unknown): value is DocPageCategory {
  return (
    typeof value === 'string' &&
    Object.values(DocPageCategory).includes(value as DocPageCategory)
  );
}

/**
 * Type guard for valid OnboardingStatus
 */
export function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return (
    typeof value === 'string' &&
    Object.values(OnboardingStatus).includes(value as OnboardingStatus)
  );
}

/**
 * Type guard for valid ChecklistCategory
 */
export function isChecklistCategory(value: unknown): value is ChecklistCategory {
  return (
    typeof value === 'string' &&
    Object.values(ChecklistCategory).includes(value as ChecklistCategory)
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new documentation page
 */
export function createDocPage(
  id: string,
  title: string,
  slug: string,
  content: string,
  category: DocPageCategory
): DocPage {
  const now = new Date().toISOString();
  return {
    id,
    title,
    slug,
    content,
    category,
    status: DocPageStatus.DRAFT,
    lastUpdated: now,
    createdAt: now,
  };
}

/**
 * Create a new beta customer
 */
export function createBetaCustomer(
  id: string,
  companyName: string,
  contactEmail: string
): BetaCustomer {
  const now = new Date().toISOString();
  return {
    id,
    companyName,
    contactEmail,
    ndaSigned: false,
    onboardingStatus: OnboardingStatus.PENDING,
    createdAt: now,
  };
}

/**
 * Create a new checklist item
 */
export function createChecklistItem(
  id: string,
  category: ChecklistCategory,
  description: string,
  priority: ChecklistPriority = ChecklistPriority.MEDIUM
): ChecklistItem {
  const now = new Date().toISOString();
  return {
    id,
    category,
    description,
    priority,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create an empty launch checklist
 */
export function createLaunchChecklist(name?: string): LaunchChecklist {
  return {
    name,
    items: [],
    overallProgress: 0,
    readyForLaunch: false,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calculate checklist progress
 */
export function calculateChecklistProgress(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const completed = items.filter(item => item.completed).length;
  return Math.round((completed / items.length) * 100);
}

/**
 * Check if launch is ready (all critical items completed)
 */
export function isReadyForLaunch(items: ChecklistItem[]): boolean {
  const criticalItems = items.filter(item => item.priority === ChecklistPriority.CRITICAL);
  return criticalItems.length > 0 && criticalItems.every(item => item.completed);
}
