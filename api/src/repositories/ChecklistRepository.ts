/**
 * Checklist Repository
 * @module repositories/ChecklistRepository
 *
 * Repository interface and in-memory implementation for launch checklist management.
 * Supports TASK-FINAL-004 launch readiness tracking.
 *
 * Note: In-memory implementation for MVP. Ready for database migration.
 */

import pino from 'pino';
import {
  ChecklistItem,
  ChecklistCategory,
  ChecklistPriority,
  LaunchChecklist,
  LaunchReadinessSummary,
  ChecklistProgressByCategory,
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
  createChecklistItem,
  createLaunchChecklist,
  calculateChecklistProgress,
  isReadyForLaunch,
} from '../types/documentation.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Filter criteria for checklist items
 */
export interface ChecklistItemFilterCriteria {
  readonly category?: ChecklistCategory;
  readonly priority?: ChecklistPriority;
  readonly completed?: boolean;
  readonly assignee?: string;
  readonly overdue?: boolean;
  readonly blocked?: boolean;
}

/**
 * Sort options for checklist items
 */
export interface ChecklistSortOptions {
  readonly field: 'priority' | 'dueDate' | 'category' | 'completed';
  readonly direction: 'asc' | 'desc';
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Checklist repository interface
 */
export interface IChecklistRepository {
  /**
   * Find item by ID
   */
  findItemById(id: string): Promise<ChecklistItem | null>;

  /**
   * Find all items matching filter
   */
  findItems(filter?: ChecklistItemFilterCriteria): Promise<ChecklistItem[]>;

  /**
   * Find items by category
   */
  findItemsByCategory(category: ChecklistCategory): Promise<ChecklistItem[]>;

  /**
   * Find items by assignee
   */
  findItemsByAssignee(assignee: string): Promise<ChecklistItem[]>;

  /**
   * Find blocked items
   */
  findBlockedItems(): Promise<ChecklistItem[]>;

  /**
   * Find overdue items
   */
  findOverdueItems(): Promise<ChecklistItem[]>;

  /**
   * Create a new item
   */
  createItem(request: CreateChecklistItemRequest): Promise<ChecklistItem>;

  /**
   * Update an existing item
   */
  updateItem(id: string, request: UpdateChecklistItemRequest): Promise<ChecklistItem | null>;

  /**
   * Mark item as completed
   */
  completeItem(id: string, completedBy: string, evidence?: string): Promise<ChecklistItem | null>;

  /**
   * Mark item as incomplete (uncomplete)
   */
  uncompleteItem(id: string): Promise<ChecklistItem | null>;

  /**
   * Delete an item
   */
  deleteItem(id: string): Promise<boolean>;

  /**
   * Get the full launch checklist
   */
  getChecklist(): Promise<LaunchChecklist>;

  /**
   * Get launch readiness summary
   */
  getReadinessSummary(): Promise<LaunchReadinessSummary>;

  /**
   * Get progress by category
   */
  getProgressByCategory(): Promise<ChecklistProgressByCategory[]>;

  /**
   * Set target launch date
   */
  setTargetLaunchDate(date: Date): Promise<void>;

  /**
   * Add a blocking dependency
   */
  addBlocker(itemId: string, blockedById: string): Promise<ChecklistItem | null>;

  /**
   * Remove a blocking dependency
   */
  removeBlocker(itemId: string, blockedById: string): Promise<ChecklistItem | null>;

  /**
   * Bulk create items
   */
  bulkCreateItems(requests: CreateChecklistItemRequest[]): Promise<ChecklistItem[]>;

  /**
   * Reset checklist (delete all items)
   */
  reset(): Promise<void>;

  /**
   * Get items that block other items
   */
  findBlockingItems(): Promise<Array<{ item: ChecklistItem; blocksCount: number }>>;

  /**
   * Get critical items that are not completed
   */
  findIncompleteCriticalItems(): Promise<ChecklistItem[]>;
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

/**
 * In-memory checklist repository implementation
 */
export class InMemoryChecklistRepository implements IChecklistRepository {
  private items: Map<string, ChecklistItem> = new Map();
  private targetLaunchDate: Date | null = null;
  private readonly logger: pino.Logger;

  constructor() {
    this.logger = pino({ name: 'repository:checklist' });
  }

  async findItemById(id: string): Promise<ChecklistItem | null> {
    this.logger.debug({ id }, 'Finding item by ID');
    return this.items.get(id) ?? null;
  }

  async findItems(filter?: ChecklistItemFilterCriteria): Promise<ChecklistItem[]> {
    this.logger.debug({ filter }, 'Finding items');
    let items = Array.from(this.items.values());

    if (filter) {
      items = this.applyFilter(items, filter);
    }

    return this.sortByPriority(items);
  }

  async findItemsByCategory(category: ChecklistCategory): Promise<ChecklistItem[]> {
    return this.findItems({ category });
  }

  async findItemsByAssignee(assignee: string): Promise<ChecklistItem[]> {
    return this.findItems({ assignee });
  }

  async findBlockedItems(): Promise<ChecklistItem[]> {
    return this.findItems({ blocked: true });
  }

  async findOverdueItems(): Promise<ChecklistItem[]> {
    return this.findItems({ overdue: true });
  }

  async createItem(request: CreateChecklistItemRequest): Promise<ChecklistItem> {
    this.logger.debug({ category: request.category }, 'Creating item');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const item: ChecklistItem = {
      id,
      category: request.category,
      description: request.description,
      priority: request.priority ?? ChecklistPriority.MEDIUM,
      completed: false,
      dueDate: request.dueDate,
      assignee: request.assignee,
      blockedBy: request.blockedBy,
      createdAt: now,
      updatedAt: now,
    };

    this.items.set(id, item);
    this.logger.info({ id, category: item.category }, 'Item created');
    return item;
  }

  async updateItem(
    id: string,
    request: UpdateChecklistItemRequest
  ): Promise<ChecklistItem | null> {
    this.logger.debug({ id }, 'Updating item');

    const existing = this.items.get(id);
    if (!existing) {
      this.logger.warn({ id }, 'Item not found for update');
      return null;
    }

    const updated: ChecklistItem = {
      ...existing,
      ...request,
      id, // Ensure ID cannot be changed
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString(),
    };

    this.items.set(id, updated);
    this.logger.info({ id }, 'Item updated');
    return updated;
  }

  async completeItem(
    id: string,
    completedBy: string,
    evidence?: string
  ): Promise<ChecklistItem | null> {
    this.logger.debug({ id, completedBy }, 'Completing item');

    const existing = this.items.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: ChecklistItem = {
      ...existing,
      completed: true,
      completedBy,
      completedAt: now,
      evidence: evidence ?? existing.evidence,
      updatedAt: now,
    };

    this.items.set(id, updated);
    this.logger.info({ id, completedBy }, 'Item completed');
    return updated;
  }

  async uncompleteItem(id: string): Promise<ChecklistItem | null> {
    this.logger.debug({ id }, 'Uncompleting item');

    const existing = this.items.get(id);
    if (!existing) return null;

    const updated: ChecklistItem = {
      ...existing,
      completed: false,
      completedBy: undefined,
      completedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(id, updated);
    this.logger.info({ id }, 'Item uncompleted');
    return updated;
  }

  async deleteItem(id: string): Promise<boolean> {
    this.logger.debug({ id }, 'Deleting item');

    if (!this.items.has(id)) {
      this.logger.warn({ id }, 'Item not found for deletion');
      return false;
    }

    // Remove this item from blockedBy lists of other items
    for (const item of this.items.values()) {
      if (item.blockedBy?.includes(id)) {
        const updated: ChecklistItem = {
          ...item,
          blockedBy: item.blockedBy.filter(blockedId => blockedId !== id),
          updatedAt: new Date().toISOString(),
        };
        this.items.set(item.id, updated);
      }
    }

    this.items.delete(id);
    this.logger.info({ id }, 'Item deleted');
    return true;
  }

  async getChecklist(): Promise<LaunchChecklist> {
    const items = await this.findItems();
    const overallProgress = calculateChecklistProgress(items);
    const readyForLaunch = isReadyForLaunch(items);

    return {
      id: 'main-checklist',
      name: 'Launch Readiness Checklist',
      items,
      overallProgress,
      readyForLaunch,
      targetLaunchDate: this.targetLaunchDate?.toISOString(),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getReadinessSummary(): Promise<LaunchReadinessSummary> {
    const items = Array.from(this.items.values());
    const totalItems = items.length;
    const completedItems = items.filter(i => i.completed).length;
    const criticalItems = items.filter(i => i.priority === ChecklistPriority.CRITICAL);
    const criticalCompleted = criticalItems.filter(i => i.completed).length;

    const now = new Date();
    const overdueItems = items.filter(item => {
      if (item.completed) return false;
      if (!item.dueDate) return false;
      return new Date(item.dueDate) < now;
    }).length;

    const blockedItems = items.filter(item => {
      if (item.completed) return false;
      if (!item.blockedBy || item.blockedBy.length === 0) return false;
      // Check if any blocker is incomplete
      return item.blockedBy.some(blockerId => {
        const blocker = this.items.get(blockerId);
        return blocker && !blocker.completed;
      });
    }).length;

    const progressByCategory = await this.getProgressByCategory();

    // Get blockers (incomplete items that block others)
    const blockers: LaunchReadinessSummary['blockers'] = [];
    for (const item of items) {
      if (item.completed) continue;
      if (!item.blockedBy || item.blockedBy.length === 0) continue;

      const incompleteBlockers = item.blockedBy.filter(id => {
        const blocker = this.items.get(id);
        return blocker && !blocker.completed;
      });

      if (incompleteBlockers.length > 0) {
        blockers.push({
          id: item.id,
          description: item.description,
          category: item.category,
          blockedBy: incompleteBlockers,
        });
      }
    }

    // Calculate estimated completion date
    let estimatedCompletionDate: string | undefined;
    if (this.targetLaunchDate && totalItems > 0) {
      const progressRate = completedItems / totalItems;
      if (progressRate > 0) {
        // Simple estimation based on current progress rate
        const daysRemaining = Math.ceil((totalItems - completedItems) / (progressRate * 7)); // Assume weekly progress
        const estimated = new Date();
        estimated.setDate(estimated.getDate() + daysRemaining);
        estimatedCompletionDate = estimated.toISOString();
      }
    }

    return {
      readyForLaunch: isReadyForLaunch(items),
      overallProgress: calculateChecklistProgress(items),
      totalItems,
      completedItems,
      criticalItems: criticalItems.length,
      criticalCompleted,
      blockedItems,
      overdueItems,
      progressByCategory,
      estimatedCompletionDate,
      blockers,
    };
  }

  async getProgressByCategory(): Promise<ChecklistProgressByCategory[]> {
    const items = Array.from(this.items.values());
    const categories = new Map<ChecklistCategory, ChecklistItem[]>();

    // Group by category
    for (const item of items) {
      if (!categories.has(item.category)) {
        categories.set(item.category, []);
      }
      categories.get(item.category)!.push(item);
    }

    // Calculate progress for each category
    const progress: ChecklistProgressByCategory[] = [];

    for (const [category, categoryItems] of categories) {
      const total = categoryItems.length;
      const completed = categoryItems.filter(i => i.completed).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      const criticalRemaining = categoryItems.filter(
        i => !i.completed && i.priority === ChecklistPriority.CRITICAL
      ).length;

      progress.push({
        category,
        total,
        completed,
        percentage,
        criticalRemaining,
      });
    }

    // Sort by category name
    return progress.sort((a, b) => a.category.localeCompare(b.category));
  }

  async setTargetLaunchDate(date: Date): Promise<void> {
    this.logger.info({ date }, 'Setting target launch date');
    this.targetLaunchDate = date;
  }

  async addBlocker(itemId: string, blockedById: string): Promise<ChecklistItem | null> {
    this.logger.debug({ itemId, blockedById }, 'Adding blocker');

    const item = this.items.get(itemId);
    if (!item) return null;

    // Verify blocker exists
    if (!this.items.has(blockedById)) {
      throw new Error(`Blocker item ${blockedById} does not exist`);
    }

    // Prevent self-blocking
    if (itemId === blockedById) {
      throw new Error('Item cannot block itself');
    }

    const blockedBy = item.blockedBy ?? [];
    if (blockedBy.includes(blockedById)) {
      return item; // Already blocked by this item
    }

    const updated: ChecklistItem = {
      ...item,
      blockedBy: [...blockedBy, blockedById],
      updatedAt: new Date().toISOString(),
    };

    this.items.set(itemId, updated);
    return updated;
  }

  async removeBlocker(itemId: string, blockedById: string): Promise<ChecklistItem | null> {
    this.logger.debug({ itemId, blockedById }, 'Removing blocker');

    const item = this.items.get(itemId);
    if (!item) return null;

    const blockedBy = item.blockedBy ?? [];
    if (!blockedBy.includes(blockedById)) {
      return item; // Not blocked by this item
    }

    const updated: ChecklistItem = {
      ...item,
      blockedBy: blockedBy.filter(id => id !== blockedById),
      updatedAt: new Date().toISOString(),
    };

    this.items.set(itemId, updated);
    return updated;
  }

  async bulkCreateItems(requests: CreateChecklistItemRequest[]): Promise<ChecklistItem[]> {
    this.logger.debug({ count: requests.length }, 'Bulk creating items');

    const created: ChecklistItem[] = [];
    for (const request of requests) {
      const item = await this.createItem(request);
      created.push(item);
    }

    this.logger.info({ count: created.length }, 'Bulk create completed');
    return created;
  }

  async reset(): Promise<void> {
    this.logger.info('Resetting checklist');
    this.items.clear();
    this.targetLaunchDate = null;
  }

  async findBlockingItems(): Promise<Array<{ item: ChecklistItem; blocksCount: number }>> {
    const blockCounts = new Map<string, number>();

    // Count how many items each item blocks
    for (const item of this.items.values()) {
      if (item.blockedBy) {
        for (const blockerId of item.blockedBy) {
          const current = blockCounts.get(blockerId) ?? 0;
          blockCounts.set(blockerId, current + 1);
        }
      }
    }

    // Build result
    const result: Array<{ item: ChecklistItem; blocksCount: number }> = [];

    for (const [id, count] of blockCounts) {
      const item = this.items.get(id);
      if (item && !item.completed) {
        result.push({ item, blocksCount: count });
      }
    }

    // Sort by blocks count descending
    return result.sort((a, b) => b.blocksCount - a.blocksCount);
  }

  async findIncompleteCriticalItems(): Promise<ChecklistItem[]> {
    return Array.from(this.items.values()).filter(
      item => !item.completed && item.priority === ChecklistPriority.CRITICAL
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private applyFilter(
    items: ChecklistItem[],
    filter: ChecklistItemFilterCriteria
  ): ChecklistItem[] {
    const now = new Date();

    return items.filter(item => {
      if (filter.category && item.category !== filter.category) {
        return false;
      }

      if (filter.priority && item.priority !== filter.priority) {
        return false;
      }

      if (filter.completed !== undefined && item.completed !== filter.completed) {
        return false;
      }

      if (filter.assignee && item.assignee !== filter.assignee) {
        return false;
      }

      if (filter.overdue) {
        if (item.completed) return false;
        if (!item.dueDate) return false;
        if (new Date(item.dueDate) >= now) return false;
      }

      if (filter.blocked) {
        if (item.completed) return false;
        if (!item.blockedBy || item.blockedBy.length === 0) return false;
        // Check if any blocker is incomplete
        const hasIncompleteBlocker = item.blockedBy.some(blockerId => {
          const blocker = this.items.get(blockerId);
          return blocker && !blocker.completed;
        });
        if (!hasIncompleteBlocker) return false;
      }

      return true;
    });
  }

  private sortByPriority(items: ChecklistItem[]): ChecklistItem[] {
    const priorityOrder: Record<ChecklistPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return items.sort((a, b) => {
      // First by completion (incomplete first)
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // Then by priority
      const priorityA = priorityOrder[a.priority ?? 'medium'];
      const priorityB = priorityOrder[b.priority ?? 'medium'];
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Then by due date (earlier first)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      // Finally by category
      return a.category.localeCompare(b.category);
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a checklist repository instance
 */
export function createChecklistRepository(): IChecklistRepository {
  return new InMemoryChecklistRepository();
}
