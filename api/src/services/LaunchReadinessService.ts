/**
 * Launch Readiness Service
 * @module services/LaunchReadinessService
 *
 * Domain service for managing launch readiness tracking. Orchestrates checklist
 * management, progress calculation, blocker identification, and launch readiness assessment.
 *
 * TASK-FINAL-004: Launch readiness tracking service implementation
 */

import pino from 'pino';
import {
  LaunchChecklistAggregate,
  ChecklistItemVO,
  createLaunchChecklist,
  createChecklistItem,
  reconstituteLaunchChecklist,
  reconstituteChecklistItem,
  Result,
  ValidationError,
  DomainError,
  type CreateChecklistItemParams,
  type CreateLaunchChecklistParams,
} from '../domain/documentation/index.js';
import type {
  LaunchChecklist,
  ChecklistItem,
  ChecklistCategory,
  ChecklistPriority,
  ChecklistProgressByCategory,
  LaunchReadinessSummary,
} from '../types/documentation.js';

const logger = pino({ name: 'launch-readiness-service' });

// ============================================================================
// Types
// ============================================================================

/**
 * DTO for creating a checklist item
 */
export interface CreateChecklistItemDTO {
  readonly category: ChecklistCategory;
  readonly description: string;
  readonly priority?: ChecklistPriority;
  readonly dueDate?: string;
  readonly assignee?: string;
  readonly blockedBy?: string[];
}

/**
 * DTO for updating a checklist item
 */
export interface UpdateChecklistItemDTO {
  readonly description?: string;
  readonly priority?: ChecklistPriority;
  readonly dueDate?: string;
  readonly assignee?: string;
  readonly notes?: string;
  readonly blockedBy?: string[];
}

/**
 * DTO for completing a checklist item
 */
export interface CompleteItemDTO {
  readonly completedBy?: string;
  readonly evidence?: string;
}

/**
 * Filter options for listing items
 */
export interface ListItemsFilter {
  readonly category?: ChecklistCategory;
  readonly priority?: ChecklistPriority;
  readonly completed?: boolean;
  readonly overdue?: boolean;
  readonly blocked?: boolean;
  readonly assignee?: string;
}

/**
 * Service error with code
 */
export interface ServiceError {
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Service result type
 */
export type ServiceResult<T> = Result<T, ServiceError>;

/**
 * Launch readiness assessment
 */
export interface LaunchReadinessAssessment {
  readonly readyForLaunch: boolean;
  readonly overallProgress: number;
  readonly blockers: BlockerInfo[];
  readonly criticalItemsRemaining: number;
  readonly overdueItemsCount: number;
  readonly estimatedCompletionDate?: string;
  readonly progressByCategory: ChecklistProgressByCategory[];
  readonly recommendations: string[];
}

/**
 * Blocker information
 */
export interface BlockerInfo {
  readonly itemId: string;
  readonly description: string;
  readonly category: ChecklistCategory;
  readonly priority?: ChecklistPriority;
  readonly blockedBy?: string[];
  readonly assignee?: string;
  readonly dueDate?: string;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  readonly successful: string[];
  readonly failed: Array<{ id: string; error: ServiceError }>;
}

// ============================================================================
// Launch Readiness Service Interface
// ============================================================================

/**
 * Launch readiness service interface
 */
export interface ILaunchReadinessService {
  /**
   * Get or create the launch checklist
   */
  getChecklist(): Promise<LaunchChecklist>;

  /**
   * Set target launch date
   */
  setTargetLaunchDate(date: string): Promise<ServiceResult<LaunchChecklist>>;

  /**
   * Clear target launch date
   */
  clearTargetLaunchDate(): Promise<ServiceResult<LaunchChecklist>>;

  /**
   * Create a new checklist item
   */
  createItem(dto: CreateChecklistItemDTO): Promise<ServiceResult<ChecklistItem>>;

  /**
   * Update a checklist item
   */
  updateItem(itemId: string, dto: UpdateChecklistItemDTO): Promise<ServiceResult<ChecklistItem>>;

  /**
   * Get a checklist item by ID
   */
  getItem(itemId: string): Promise<ChecklistItem | null>;

  /**
   * List checklist items with filtering
   */
  listItems(filter?: ListItemsFilter): Promise<ChecklistItem[]>;

  /**
   * Complete a checklist item
   */
  completeItem(itemId: string, dto?: CompleteItemDTO): Promise<ServiceResult<ChecklistItem>>;

  /**
   * Uncomplete a checklist item
   */
  uncompleteItem(itemId: string): Promise<ServiceResult<ChecklistItem>>;

  /**
   * Add a blocker to an item
   */
  addBlocker(itemId: string, blockerId: string): Promise<ServiceResult<ChecklistItem>>;

  /**
   * Remove a blocker from an item
   */
  removeBlocker(itemId: string, blockerId: string): Promise<ServiceResult<ChecklistItem>>;

  /**
   * Delete a checklist item
   */
  deleteItem(itemId: string): Promise<boolean>;

  /**
   * Bulk complete items
   */
  bulkCompleteItems(itemIds: string[], dto?: CompleteItemDTO): Promise<BulkOperationResult>;

  /**
   * Bulk assign items
   */
  bulkAssignItems(itemIds: string[], assignee: string): Promise<BulkOperationResult>;

  /**
   * Get launch readiness summary
   */
  getReadinessSummary(): Promise<LaunchReadinessSummary>;

  /**
   * Get launch readiness assessment with recommendations
   */
  assessLaunchReadiness(): Promise<LaunchReadinessAssessment>;

  /**
   * Get progress by category
   */
  getProgressByCategory(): Promise<ChecklistProgressByCategory[]>;

  /**
   * Get blocked items
   */
  getBlockedItems(): Promise<ChecklistItem[]>;

  /**
   * Get overdue items
   */
  getOverdueItems(): Promise<ChecklistItem[]>;

  /**
   * Get critical items
   */
  getCriticalItems(): Promise<ChecklistItem[]>;

  /**
   * Reset the checklist (for testing or fresh start)
   */
  resetChecklist(): Promise<void>;
}

// ============================================================================
// Launch Readiness Service Implementation
// ============================================================================

/**
 * Launch Readiness Service Implementation
 *
 * Manages launch checklist with in-memory storage (MVP).
 * Will be replaced with repository injection for production.
 */
export class LaunchReadinessService implements ILaunchReadinessService {
  /**
   * The launch checklist aggregate (singleton per service instance)
   */
  private checklist: LaunchChecklistAggregate;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  constructor() {
    this.checklist = createLaunchChecklist({ name: 'Launch Readiness Checklist' });
    logger.info('LaunchReadinessService initialized');
  }

  // ==========================================================================
  // Checklist Management
  // ==========================================================================

  /**
   * Get or create the launch checklist
   */
  async getChecklist(): Promise<LaunchChecklist> {
    return this.checklist.toJSON();
  }

  /**
   * Set target launch date
   */
  async setTargetLaunchDate(date: string): Promise<ServiceResult<LaunchChecklist>> {
    logger.info({ date }, 'Setting target launch date');

    try {
      this.checklist.setTargetLaunchDate(date);
      logger.info({ date }, 'Target launch date set');
      return Result.ok(this.checklist.toJSON());
    } catch (error) {
      logger.error({ error, date }, 'Failed to set target launch date');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'SET_DATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to set target date',
      });
    }
  }

  /**
   * Clear target launch date
   */
  async clearTargetLaunchDate(): Promise<ServiceResult<LaunchChecklist>> {
    logger.info('Clearing target launch date');
    this.checklist.clearTargetLaunchDate();
    return Result.ok(this.checklist.toJSON());
  }

  // ==========================================================================
  // Item Management
  // ==========================================================================

  /**
   * Create a new checklist item
   */
  async createItem(dto: CreateChecklistItemDTO): Promise<ServiceResult<ChecklistItem>> {
    logger.info({ dto: { category: dto.category, description: dto.description.substring(0, 50) } }, 'Creating checklist item');

    try {
      const params: CreateChecklistItemParams = {
        category: dto.category,
        description: dto.description,
        priority: dto.priority,
        dueDate: dto.dueDate,
        assignee: dto.assignee,
        blockedBy: dto.blockedBy,
      };

      const result = this.checklist.createItem(params);

      if (Result.isErr(result)) {
        const error = result.error;
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      logger.info({ itemId: result.value.id }, 'Checklist item created');
      return Result.ok(result.value.toJSON());
    } catch (error) {
      logger.error({ error }, 'Failed to create checklist item');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create item',
      });
    }
  }

  /**
   * Update a checklist item
   */
  async updateItem(itemId: string, dto: UpdateChecklistItemDTO): Promise<ServiceResult<ChecklistItem>> {
    logger.info({ itemId, updates: Object.keys(dto) }, 'Updating checklist item');

    try {
      const item = this.checklist.getItem(itemId);
      if (!item) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Item ${itemId} not found`,
          context: { itemId },
        });
      }

      // Apply updates by creating new immutable versions
      let updatedItem = item;

      if (dto.assignee !== undefined) {
        updatedItem = updatedItem.assign(dto.assignee);
      }

      if (dto.notes !== undefined) {
        updatedItem = updatedItem.addNotes(dto.notes);
      }

      if (dto.dueDate !== undefined) {
        updatedItem = updatedItem.setDueDate(dto.dueDate);
      }

      if (dto.blockedBy !== undefined) {
        // Clear existing blockers and add new ones
        if (updatedItem.blockedBy) {
          for (const blockerId of updatedItem.blockedBy) {
            updatedItem = updatedItem.removeBlocker(blockerId);
          }
        }
        for (const blockerId of dto.blockedBy) {
          updatedItem = updatedItem.addBlocker(blockerId);
        }
      }

      // Note: description and priority require recreating the item
      // For now, we'll update what we can
      if (dto.description !== undefined || dto.priority !== undefined) {
        // Create a new item with updated values
        const newParams: CreateChecklistItemParams = {
          id: itemId,
          category: item.category,
          description: dto.description ?? item.description,
          priority: dto.priority ?? item.priority,
          dueDate: updatedItem.dueDate,
          assignee: updatedItem.assignee,
          blockedBy: updatedItem.blockedBy,
        };

        const newItemResult = createChecklistItem(newParams);
        if (Result.isErr(newItemResult)) {
          return Result.err({
            code: newItemResult.error.code,
            message: newItemResult.error.message,
            context: newItemResult.error.context,
          });
        }

        updatedItem = newItemResult.value;

        // Preserve completion status
        if (item.completed) {
          updatedItem = updatedItem.complete(item.completedBy, item.evidence);
        }

        // Preserve notes
        if (item.notes) {
          updatedItem = updatedItem.addNotes(item.notes);
        }
      }

      this.checklist.updateItem(itemId, updatedItem);

      logger.info({ itemId }, 'Checklist item updated');
      return Result.ok(updatedItem.toJSON());
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to update checklist item');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update item',
      });
    }
  }

  /**
   * Get a checklist item by ID
   */
  async getItem(itemId: string): Promise<ChecklistItem | null> {
    const item = this.checklist.getItem(itemId);
    return item ? item.toJSON() : null;
  }

  /**
   * List checklist items with filtering
   */
  async listItems(filter?: ListItemsFilter): Promise<ChecklistItem[]> {
    logger.debug({ filter }, 'Listing checklist items');

    let items = this.checklist.items.map(data => reconstituteChecklistItem(data));

    if (filter) {
      if (filter.category) {
        items = items.filter(item => item.category === filter.category);
      }

      if (filter.priority) {
        items = items.filter(item => item.priority === filter.priority);
      }

      if (filter.completed !== undefined) {
        items = items.filter(item => item.completed === filter.completed);
      }

      if (filter.overdue) {
        items = items.filter(item => item.isOverdue);
      }

      if (filter.blocked) {
        items = items.filter(item => item.isBlocked);
      }

      if (filter.assignee) {
        items = items.filter(item => item.assignee === filter.assignee);
      }
    }

    return items.map(item => item.toJSON());
  }

  // ==========================================================================
  // Completion Operations
  // ==========================================================================

  /**
   * Complete a checklist item
   */
  async completeItem(itemId: string, dto?: CompleteItemDTO): Promise<ServiceResult<ChecklistItem>> {
    logger.info({ itemId, completedBy: dto?.completedBy }, 'Completing checklist item');

    try {
      this.checklist.completeItem(itemId, dto?.completedBy, dto?.evidence);
      const item = this.checklist.getItem(itemId)!;

      logger.info({ itemId }, 'Checklist item completed');
      return Result.ok(item.toJSON());
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to complete checklist item');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'COMPLETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to complete item',
      });
    }
  }

  /**
   * Uncomplete a checklist item
   */
  async uncompleteItem(itemId: string): Promise<ServiceResult<ChecklistItem>> {
    logger.info({ itemId }, 'Uncompleting checklist item');

    try {
      this.checklist.uncompleteItem(itemId);
      const item = this.checklist.getItem(itemId)!;

      logger.info({ itemId }, 'Checklist item uncompleted');
      return Result.ok(item.toJSON());
    } catch (error) {
      logger.error({ error, itemId }, 'Failed to uncomplete checklist item');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'UNCOMPLETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to uncomplete item',
      });
    }
  }

  // ==========================================================================
  // Blocker Operations
  // ==========================================================================

  /**
   * Add a blocker to an item
   */
  async addBlocker(itemId: string, blockerId: string): Promise<ServiceResult<ChecklistItem>> {
    logger.info({ itemId, blockerId }, 'Adding blocker to item');

    try {
      const item = this.checklist.getItem(itemId);
      if (!item) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Item ${itemId} not found`,
          context: { itemId },
        });
      }

      // Verify blocker exists
      const blocker = this.checklist.getItem(blockerId);
      if (!blocker) {
        return Result.err({
          code: 'BLOCKER_NOT_FOUND',
          message: `Blocker item ${blockerId} not found`,
          context: { blockerId },
        });
      }

      // Prevent self-blocking
      if (itemId === blockerId) {
        return Result.err({
          code: 'SELF_BLOCK',
          message: 'Item cannot block itself',
          context: { itemId },
        });
      }

      const updatedItem = item.addBlocker(blockerId);
      this.checklist.updateItem(itemId, updatedItem);

      logger.info({ itemId, blockerId }, 'Blocker added');
      return Result.ok(updatedItem.toJSON());
    } catch (error) {
      logger.error({ error, itemId, blockerId }, 'Failed to add blocker');

      return Result.err({
        code: 'ADD_BLOCKER_FAILED',
        message: error instanceof Error ? error.message : 'Failed to add blocker',
      });
    }
  }

  /**
   * Remove a blocker from an item
   */
  async removeBlocker(itemId: string, blockerId: string): Promise<ServiceResult<ChecklistItem>> {
    logger.info({ itemId, blockerId }, 'Removing blocker from item');

    try {
      const item = this.checklist.getItem(itemId);
      if (!item) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Item ${itemId} not found`,
          context: { itemId },
        });
      }

      const updatedItem = item.removeBlocker(blockerId);
      this.checklist.updateItem(itemId, updatedItem);

      logger.info({ itemId, blockerId }, 'Blocker removed');
      return Result.ok(updatedItem.toJSON());
    } catch (error) {
      logger.error({ error, itemId, blockerId }, 'Failed to remove blocker');

      return Result.err({
        code: 'REMOVE_BLOCKER_FAILED',
        message: error instanceof Error ? error.message : 'Failed to remove blocker',
      });
    }
  }

  // ==========================================================================
  // Delete Operations
  // ==========================================================================

  /**
   * Delete a checklist item
   */
  async deleteItem(itemId: string): Promise<boolean> {
    logger.info({ itemId }, 'Deleting checklist item');
    const deleted = this.checklist.removeItem(itemId);
    if (deleted) {
      logger.info({ itemId }, 'Checklist item deleted');
    }
    return deleted;
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Bulk complete items
   */
  async bulkCompleteItems(itemIds: string[], dto?: CompleteItemDTO): Promise<BulkOperationResult> {
    logger.info({ itemIds, completedBy: dto?.completedBy }, 'Bulk completing items');

    const successful: string[] = [];
    const failed: Array<{ id: string; error: ServiceError }> = [];

    for (const itemId of itemIds) {
      const result = await this.completeItem(itemId, dto);
      if (Result.isOk(result)) {
        successful.push(itemId);
      } else {
        failed.push({ id: itemId, error: result.error });
      }
    }

    logger.info({ successful: successful.length, failed: failed.length }, 'Bulk complete finished');
    return { successful, failed };
  }

  /**
   * Bulk assign items
   */
  async bulkAssignItems(itemIds: string[], assignee: string): Promise<BulkOperationResult> {
    logger.info({ itemIds, assignee }, 'Bulk assigning items');

    const successful: string[] = [];
    const failed: Array<{ id: string; error: ServiceError }> = [];

    for (const itemId of itemIds) {
      const result = await this.updateItem(itemId, { assignee });
      if (Result.isOk(result)) {
        successful.push(itemId);
      } else {
        failed.push({ id: itemId, error: result.error });
      }
    }

    logger.info({ successful: successful.length, failed: failed.length }, 'Bulk assign finished');
    return { successful, failed };
  }

  // ==========================================================================
  // Readiness Assessment
  // ==========================================================================

  /**
   * Get launch readiness summary
   */
  async getReadinessSummary(): Promise<LaunchReadinessSummary> {
    return this.checklist.getReadinessSummary();
  }

  /**
   * Get launch readiness assessment with recommendations
   */
  async assessLaunchReadiness(): Promise<LaunchReadinessAssessment> {
    logger.debug('Assessing launch readiness');

    const summary = this.checklist.getReadinessSummary();
    const recommendations: string[] = [];

    // Build blocker info
    const blockedItems = this.checklist.getBlockedItems();
    const blockers: BlockerInfo[] = blockedItems.map(item => ({
      itemId: item.id,
      description: item.description,
      category: item.category,
      priority: item.priority,
      blockedBy: item.blockedBy,
      assignee: item.assignee,
      dueDate: item.dueDate,
    }));

    // Critical items
    const criticalIncomplete = this.checklist.getCriticalIncomplete();
    const criticalItemsRemaining = criticalIncomplete.length;

    // Overdue items
    const overdueItems = this.checklist.getOverdueItems();

    // Generate recommendations
    if (criticalItemsRemaining > 0) {
      recommendations.push(
        `Complete ${criticalItemsRemaining} critical item${criticalItemsRemaining > 1 ? 's' : ''} before launch`
      );

      // List critical items
      for (const item of criticalIncomplete.slice(0, 3)) {
        recommendations.push(`  - [CRITICAL] ${item.description}`);
      }
    }

    if (blockedItems.length > 0) {
      recommendations.push(
        `Resolve ${blockedItems.length} blocked item${blockedItems.length > 1 ? 's' : ''}`
      );
    }

    if (overdueItems.length > 0) {
      recommendations.push(
        `Address ${overdueItems.length} overdue item${overdueItems.length > 1 ? 's' : ''}`
      );
    }

    // Category-specific recommendations
    for (const categoryProgress of summary.progressByCategory) {
      if (categoryProgress.criticalRemaining > 0) {
        recommendations.push(
          `${categoryProgress.category}: ${categoryProgress.criticalRemaining} critical item${categoryProgress.criticalRemaining > 1 ? 's' : ''} remaining`
        );
      }

      if (categoryProgress.percentage < 50) {
        recommendations.push(
          `${categoryProgress.category}: Only ${categoryProgress.percentage}% complete - needs attention`
        );
      }
    }

    if (summary.readyForLaunch) {
      recommendations.unshift('All critical items complete - ready for launch!');
    } else {
      recommendations.unshift('Not yet ready for launch - critical items remain');
    }

    return {
      readyForLaunch: summary.readyForLaunch,
      overallProgress: summary.overallProgress,
      blockers,
      criticalItemsRemaining,
      overdueItemsCount: overdueItems.length,
      estimatedCompletionDate: summary.estimatedCompletionDate,
      progressByCategory: summary.progressByCategory,
      recommendations,
    };
  }

  /**
   * Get progress by category
   */
  async getProgressByCategory(): Promise<ChecklistProgressByCategory[]> {
    return this.checklist.getProgressByCategory();
  }

  /**
   * Get blocked items
   */
  async getBlockedItems(): Promise<ChecklistItem[]> {
    return this.checklist.getBlockedItems().map(item => item.toJSON());
  }

  /**
   * Get overdue items
   */
  async getOverdueItems(): Promise<ChecklistItem[]> {
    return this.checklist.getOverdueItems().map(item => item.toJSON());
  }

  /**
   * Get critical items
   */
  async getCriticalItems(): Promise<ChecklistItem[]> {
    return this.checklist.getItemsByPriority('critical').map(item => item.toJSON());
  }

  /**
   * Reset the checklist (for testing or fresh start)
   */
  async resetChecklist(): Promise<void> {
    logger.info('Resetting launch checklist');
    this.checklist = createLaunchChecklist({ name: 'Launch Readiness Checklist' });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new LaunchReadinessService instance
 */
export function createLaunchReadinessService(): ILaunchReadinessService {
  return new LaunchReadinessService();
}

// ============================================================================
// Singleton Instance
// ============================================================================

let launchReadinessServiceInstance: ILaunchReadinessService | null = null;

/**
 * Get the singleton LaunchReadinessService instance
 */
export function getLaunchReadinessService(): ILaunchReadinessService {
  if (!launchReadinessServiceInstance) {
    launchReadinessServiceInstance = createLaunchReadinessService();
  }
  return launchReadinessServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetLaunchReadinessService(): void {
  launchReadinessServiceInstance = null;
}

// ============================================================================
// Default Checklist Items
// ============================================================================

/**
 * Pre-defined checklist items for a standard launch
 */
export const DEFAULT_LAUNCH_CHECKLIST_ITEMS: CreateChecklistItemDTO[] = [
  // Infrastructure
  { category: 'infrastructure', description: 'Production environment provisioned and configured', priority: 'critical' },
  { category: 'infrastructure', description: 'CDN configured for static assets', priority: 'high' },
  { category: 'infrastructure', description: 'Database backups configured and tested', priority: 'critical' },
  { category: 'infrastructure', description: 'Monitoring and alerting configured', priority: 'critical' },
  { category: 'infrastructure', description: 'Auto-scaling policies configured', priority: 'high' },
  { category: 'infrastructure', description: 'Load balancer health checks configured', priority: 'high' },

  // Security
  { category: 'security', description: 'SSL/TLS certificates installed and valid', priority: 'critical' },
  { category: 'security', description: 'Security audit completed', priority: 'critical' },
  { category: 'security', description: 'Penetration testing completed', priority: 'high' },
  { category: 'security', description: 'API rate limiting configured', priority: 'high' },
  { category: 'security', description: 'Authentication and authorization tested', priority: 'critical' },
  { category: 'security', description: 'Secrets management configured', priority: 'critical' },

  // Documentation
  { category: 'documentation', description: 'API documentation complete and published', priority: 'high' },
  { category: 'documentation', description: 'User guides written and reviewed', priority: 'high' },
  { category: 'documentation', description: 'Integration guides complete', priority: 'medium' },
  { category: 'documentation', description: 'FAQ and troubleshooting guides created', priority: 'medium' },

  // Testing
  { category: 'testing', description: 'Unit test coverage meets threshold', priority: 'high' },
  { category: 'testing', description: 'Integration tests passing', priority: 'critical' },
  { category: 'testing', description: 'End-to-end tests passing', priority: 'critical' },
  { category: 'testing', description: 'Performance testing completed', priority: 'high' },
  { category: 'testing', description: 'User acceptance testing completed', priority: 'high' },

  // Compliance
  { category: 'compliance', description: 'Privacy policy updated and published', priority: 'critical' },
  { category: 'compliance', description: 'Terms of service updated and published', priority: 'critical' },
  { category: 'compliance', description: 'GDPR compliance verified', priority: 'high' },
  { category: 'compliance', description: 'Data retention policies documented', priority: 'medium' },

  // Marketing
  { category: 'marketing', description: 'Landing page live and tested', priority: 'high' },
  { category: 'marketing', description: 'Press release prepared', priority: 'medium' },
  { category: 'marketing', description: 'Social media announcements scheduled', priority: 'medium' },
  { category: 'marketing', description: 'Email campaigns configured', priority: 'medium' },

  // Support
  { category: 'support', description: 'Support ticket system configured', priority: 'high' },
  { category: 'support', description: 'Support team trained on product', priority: 'high' },
  { category: 'support', description: 'Escalation procedures documented', priority: 'medium' },
  { category: 'support', description: 'SLA defined and published', priority: 'medium' },

  // Legal
  { category: 'legal', description: 'Trademark registration completed', priority: 'low' },
  { category: 'legal', description: 'Software licenses audited', priority: 'medium' },
  { category: 'legal', description: 'Customer contracts reviewed', priority: 'medium' },
];

/**
 * Initialize checklist with default items
 */
export async function initializeDefaultChecklist(
  service: ILaunchReadinessService
): Promise<void> {
  logger.info('Initializing default checklist items');

  for (const item of DEFAULT_LAUNCH_CHECKLIST_ITEMS) {
    await service.createItem(item);
  }

  logger.info({ itemCount: DEFAULT_LAUNCH_CHECKLIST_ITEMS.length }, 'Default checklist items created');
}
