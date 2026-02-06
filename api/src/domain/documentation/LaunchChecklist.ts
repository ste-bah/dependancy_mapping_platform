/**
 * Launch Checklist Value Object and Aggregate
 * @module domain/documentation/LaunchChecklist
 *
 * Value objects and aggregate for launch readiness tracking.
 * Manages checklist items, progress calculation, and readiness assessment.
 *
 * TASK-FINAL-004: Documentation system domain implementation
 */

import { randomUUID } from 'crypto';
import {
  LaunchChecklist as LaunchChecklistType,
  ChecklistItem as ChecklistItemType,
  ChecklistCategory,
  ChecklistPriority,
  ChecklistProgressByCategory,
  LaunchReadinessSummary,
} from '../../types/documentation.js';
import { Result, ValidationResult, ValidationError, DomainError } from './result.js';

// ============================================================================
// Checklist Item Value Object
// ============================================================================

/**
 * Parameters for creating a checklist item
 */
export interface CreateChecklistItemParams {
  category: ChecklistCategory;
  description: string;
  priority?: ChecklistPriority;
  dueDate?: string;
  assignee?: string;
  blockedBy?: string[];
  id?: string;
}

/**
 * Checklist Item Value Object
 *
 * Represents a single item in the launch checklist. Immutable value object
 * with domain methods for state transitions.
 */
export class ChecklistItemVO implements ChecklistItemType {
  public readonly id: string;
  public readonly category: ChecklistCategory;
  public readonly description: string;
  public readonly priority?: ChecklistPriority;
  public readonly completed: boolean;
  public readonly completedBy?: string;
  public readonly completedAt?: string;
  public readonly dueDate?: string;
  public readonly assignee?: string;
  public readonly notes?: string;
  public readonly blockedBy?: string[];
  public readonly evidence?: string;
  public readonly createdAt?: string;
  public readonly updatedAt?: string;

  private constructor(data: ChecklistItemType) {
    this.id = data.id;
    this.category = data.category;
    this.description = data.description;
    this.priority = data.priority;
    this.completed = data.completed;
    this.completedBy = data.completedBy;
    this.completedAt = data.completedAt;
    this.dueDate = data.dueDate;
    this.assignee = data.assignee;
    this.notes = data.notes;
    this.blockedBy = data.blockedBy ? [...data.blockedBy] : undefined;
    this.evidence = data.evidence;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;

    // Freeze to ensure immutability
    Object.freeze(this);
    if (this.blockedBy) {
      Object.freeze(this.blockedBy);
    }
  }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if item is critical priority
   */
  get isCritical(): boolean {
    return this.priority === 'critical';
  }

  /**
   * Check if item is blocked
   */
  get isBlocked(): boolean {
    return this.blockedBy !== undefined && this.blockedBy.length > 0;
  }

  /**
   * Check if item is overdue
   */
  get isOverdue(): boolean {
    if (!this.dueDate || this.completed) return false;
    return new Date(this.dueDate) < new Date();
  }

  /**
   * Check if item is assigned
   */
  get isAssigned(): boolean {
    return this.assignee !== undefined && this.assignee.length > 0;
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new checklist item with validation
   */
  static create(params: CreateChecklistItemParams): ValidationResult<ChecklistItemVO> {
    // Validate category
    const validCategories: ChecklistCategory[] = [
      'infrastructure', 'security', 'documentation', 'testing',
      'compliance', 'marketing', 'support', 'legal',
    ];

    if (!params.category || !validCategories.includes(params.category)) {
      return Result.err(
        ValidationError.invalidValue('category', params.category, `Must be one of: ${validCategories.join(', ')}`)
      );
    }

    // Validate description
    if (!params.description || typeof params.description !== 'string') {
      return Result.err(ValidationError.required('description'));
    }

    const trimmedDescription = params.description.trim();
    if (trimmedDescription.length === 0) {
      return Result.err(
        ValidationError.invalidValue('description', params.description, 'Description cannot be empty')
      );
    }

    if (trimmedDescription.length > 500) {
      return Result.err(
        ValidationError.outOfRange('description', 1, 500)
      );
    }

    // Validate priority if provided
    const validPriorities: ChecklistPriority[] = ['critical', 'high', 'medium', 'low'];
    if (params.priority && !validPriorities.includes(params.priority)) {
      return Result.err(
        ValidationError.invalidValue('priority', params.priority, `Must be one of: ${validPriorities.join(', ')}`)
      );
    }

    // Validate due date if provided
    if (params.dueDate && isNaN(Date.parse(params.dueDate))) {
      return Result.err(
        ValidationError.invalidFormat('dueDate', 'ISO 8601 date-time string')
      );
    }

    const now = new Date().toISOString();

    return Result.ok(
      new ChecklistItemVO({
        id: params.id ?? randomUUID(),
        category: params.category,
        description: trimmedDescription,
        priority: params.priority,
        completed: false,
        dueDate: params.dueDate,
        assignee: params.assignee?.trim() || undefined,
        blockedBy: params.blockedBy,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstitute from persisted data
   */
  static reconstitute(data: ChecklistItemType): ChecklistItemVO {
    return new ChecklistItemVO(data);
  }

  // ==========================================================================
  // Value Object Methods (Return New Instances)
  // ==========================================================================

  /**
   * Create a completed version of this item
   */
  complete(completedBy?: string, evidence?: string): ChecklistItemVO {
    if (this.completed) {
      return this; // Already completed, return same instance
    }

    const now = new Date().toISOString();
    return new ChecklistItemVO({
      ...this.toJSON(),
      completed: true,
      completedBy,
      completedAt: now,
      evidence,
      updatedAt: now,
    });
  }

  /**
   * Create an uncompleted version of this item
   */
  uncomplete(): ChecklistItemVO {
    if (!this.completed) {
      return this; // Already uncompleted
    }

    return new ChecklistItemVO({
      ...this.toJSON(),
      completed: false,
      completedBy: undefined,
      completedAt: undefined,
      evidence: undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Create a version with updated assignee
   */
  assign(assignee: string): ChecklistItemVO {
    return new ChecklistItemVO({
      ...this.toJSON(),
      assignee: assignee.trim(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Create a version with notes added
   */
  addNotes(notes: string): ChecklistItemVO {
    return new ChecklistItemVO({
      ...this.toJSON(),
      notes,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Create a version with updated due date
   */
  setDueDate(dueDate: string): ChecklistItemVO {
    return new ChecklistItemVO({
      ...this.toJSON(),
      dueDate,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Create a version with a blocker added
   */
  addBlocker(blockerId: string): ChecklistItemVO {
    const blockedBy = this.blockedBy ? [...this.blockedBy] : [];
    if (!blockedBy.includes(blockerId)) {
      blockedBy.push(blockerId);
    }

    return new ChecklistItemVO({
      ...this.toJSON(),
      blockedBy,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Create a version with a blocker removed
   */
  removeBlocker(blockerId: string): ChecklistItemVO {
    if (!this.blockedBy) return this;

    const blockedBy = this.blockedBy.filter(id => id !== blockerId);

    return new ChecklistItemVO({
      ...this.toJSON(),
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object
   */
  toJSON(): ChecklistItemType {
    return {
      id: this.id,
      category: this.category,
      description: this.description,
      priority: this.priority,
      completed: this.completed,
      completedBy: this.completedBy,
      completedAt: this.completedAt,
      dueDate: this.dueDate,
      assignee: this.assignee,
      notes: this.notes,
      blockedBy: this.blockedBy ? [...this.blockedBy] : undefined,
      evidence: this.evidence,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Check equality with another item
   */
  equals(other: ChecklistItemVO): boolean {
    return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
  }

  toString(): string {
    const status = this.completed ? 'DONE' : this.isBlocked ? 'BLOCKED' : 'PENDING';
    return `ChecklistItem(${this.id}, "${this.description.substring(0, 30)}...", ${status})`;
  }
}

// ============================================================================
// Launch Checklist Aggregate
// ============================================================================

/**
 * Parameters for creating a launch checklist
 */
export interface CreateLaunchChecklistParams {
  name?: string;
  targetLaunchDate?: string;
  id?: string;
}

/**
 * Launch Checklist Aggregate
 *
 * Manages a collection of checklist items for launch readiness tracking.
 * Calculates progress, tracks blockers, and determines launch readiness.
 */
export class LaunchChecklistAggregate implements LaunchChecklistType {
  public readonly id?: string;
  public readonly name?: string;
  private _items: ChecklistItemVO[];
  private _targetLaunchDate?: string;
  private _lastUpdated: string;

  private constructor(
    items: ChecklistItemVO[],
    name?: string,
    id?: string,
    targetLaunchDate?: string,
    lastUpdated?: string
  ) {
    this.id = id;
    this.name = name;
    this._items = items;
    this._targetLaunchDate = targetLaunchDate;
    this._lastUpdated = lastUpdated ?? new Date().toISOString();
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get items(): ChecklistItemType[] {
    return this._items.map(item => item.toJSON());
  }

  get targetLaunchDate(): string | undefined {
    return this._targetLaunchDate;
  }

  get lastUpdated(): string {
    return this._lastUpdated;
  }

  // ==========================================================================
  // Computed Properties (Metrics)
  // ==========================================================================

  /**
   * Calculate overall progress percentage
   */
  get overallProgress(): number {
    if (this._items.length === 0) return 0;
    const completed = this._items.filter(item => item.completed).length;
    return Math.round((completed / this._items.length) * 100);
  }

  /**
   * Determine if ready for launch (all critical items completed)
   */
  get readyForLaunch(): boolean {
    const criticalItems = this._items.filter(item => item.isCritical);
    if (criticalItems.length === 0) return this._items.length === 0 || this.overallProgress === 100;
    return criticalItems.every(item => item.completed);
  }

  /**
   * Count of total items
   */
  get totalItems(): number {
    return this._items.length;
  }

  /**
   * Count of completed items
   */
  get completedItems(): number {
    return this._items.filter(item => item.completed).length;
  }

  /**
   * Count of blocked items
   */
  get blockedItems(): number {
    return this._items.filter(item => item.isBlocked && !item.completed).length;
  }

  /**
   * Count of overdue items
   */
  get overdueItems(): number {
    return this._items.filter(item => item.isOverdue).length;
  }

  /**
   * Count of critical items
   */
  get criticalItems(): number {
    return this._items.filter(item => item.isCritical).length;
  }

  /**
   * Count of completed critical items
   */
  get criticalCompleted(): number {
    return this._items.filter(item => item.isCritical && item.completed).length;
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new empty checklist
   */
  static create(params: CreateLaunchChecklistParams = {}): LaunchChecklistAggregate {
    return new LaunchChecklistAggregate(
      [],
      params.name,
      params.id ?? randomUUID(),
      params.targetLaunchDate,
      new Date().toISOString()
    );
  }

  /**
   * Reconstitute from persisted data
   */
  static reconstitute(data: LaunchChecklistType): LaunchChecklistAggregate {
    const items = data.items.map(item => ChecklistItemVO.reconstitute(item));
    return new LaunchChecklistAggregate(
      items,
      data.name,
      data.id,
      data.targetLaunchDate,
      data.lastUpdated
    );
  }

  // ==========================================================================
  // Item Management
  // ==========================================================================

  /**
   * Add an item to the checklist
   */
  addItem(item: ChecklistItemVO): void {
    // Check for duplicates
    if (this._items.some(existing => existing.id === item.id)) {
      throw new DomainError(
        'Item already exists in checklist',
        'DUPLICATE_ITEM',
        { itemId: item.id }
      );
    }

    this._items.push(item);
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Create and add a new item
   */
  createItem(params: CreateChecklistItemParams): ValidationResult<ChecklistItemVO> {
    const result = ChecklistItemVO.create(params);
    if (Result.isOk(result)) {
      this.addItem(result.value);
    }
    return result;
  }

  /**
   * Get an item by ID
   */
  getItem(itemId: string): ChecklistItemVO | undefined {
    return this._items.find(item => item.id === itemId);
  }

  /**
   * Update an item (replace with new version)
   */
  updateItem(itemId: string, updatedItem: ChecklistItemVO): void {
    const index = this._items.findIndex(item => item.id === itemId);
    if (index === -1) {
      throw new DomainError(
        'Item not found in checklist',
        'ITEM_NOT_FOUND',
        { itemId }
      );
    }

    if (updatedItem.id !== itemId) {
      throw new DomainError(
        'Item ID mismatch',
        'ITEM_ID_MISMATCH',
        { expectedId: itemId, actualId: updatedItem.id }
      );
    }

    this._items[index] = updatedItem;
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Remove an item from the checklist
   */
  removeItem(itemId: string): boolean {
    const index = this._items.findIndex(item => item.id === itemId);
    if (index === -1) {
      return false;
    }

    // Also remove this item from any blockedBy arrays
    this._items = this._items.map(item => {
      if (item.blockedBy?.includes(itemId)) {
        return item.removeBlocker(itemId);
      }
      return item;
    });

    this._items.splice(index, 1);
    this._lastUpdated = new Date().toISOString();
    return true;
  }

  /**
   * Complete an item
   */
  completeItem(itemId: string, completedBy?: string, evidence?: string): void {
    const item = this.getItem(itemId);
    if (!item) {
      throw new DomainError(
        'Item not found in checklist',
        'ITEM_NOT_FOUND',
        { itemId }
      );
    }

    const updatedItem = item.complete(completedBy, evidence);
    this.updateItem(itemId, updatedItem);
  }

  /**
   * Uncomplete an item
   */
  uncompleteItem(itemId: string): void {
    const item = this.getItem(itemId);
    if (!item) {
      throw new DomainError(
        'Item not found in checklist',
        'ITEM_NOT_FOUND',
        { itemId }
      );
    }

    const updatedItem = item.uncomplete();
    this.updateItem(itemId, updatedItem);
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get items by category
   */
  getItemsByCategory(category: ChecklistCategory): ChecklistItemVO[] {
    return this._items.filter(item => item.category === category);
  }

  /**
   * Get items by priority
   */
  getItemsByPriority(priority: ChecklistPriority): ChecklistItemVO[] {
    return this._items.filter(item => item.priority === priority);
  }

  /**
   * Get incomplete items
   */
  getIncompleteItems(): ChecklistItemVO[] {
    return this._items.filter(item => !item.completed);
  }

  /**
   * Get blocked items
   */
  getBlockedItems(): ChecklistItemVO[] {
    return this._items.filter(item => item.isBlocked && !item.completed);
  }

  /**
   * Get overdue items
   */
  getOverdueItems(): ChecklistItemVO[] {
    return this._items.filter(item => item.isOverdue);
  }

  /**
   * Get critical incomplete items
   */
  getCriticalIncomplete(): ChecklistItemVO[] {
    return this._items.filter(item => item.isCritical && !item.completed);
  }

  // ==========================================================================
  // Progress Calculation
  // ==========================================================================

  /**
   * Calculate progress by category
   */
  getProgressByCategory(): ChecklistProgressByCategory[] {
    const categories: ChecklistCategory[] = [
      'infrastructure', 'security', 'documentation', 'testing',
      'compliance', 'marketing', 'support', 'legal',
    ];

    return categories
      .map(category => {
        const categoryItems = this.getItemsByCategory(category);
        const total = categoryItems.length;
        const completed = categoryItems.filter(item => item.completed).length;
        const criticalRemaining = categoryItems.filter(
          item => item.isCritical && !item.completed
        ).length;

        return {
          category,
          total,
          completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          criticalRemaining,
        };
      })
      .filter(progress => progress.total > 0);
  }

  /**
   * Get launch readiness summary
   */
  getReadinessSummary(): LaunchReadinessSummary {
    const blockers = this.getBlockedItems().map(item => ({
      id: item.id,
      description: item.description,
      category: item.category,
      blockedBy: item.blockedBy,
    }));

    return {
      readyForLaunch: this.readyForLaunch,
      overallProgress: this.overallProgress,
      totalItems: this.totalItems,
      completedItems: this.completedItems,
      criticalItems: this.criticalItems,
      criticalCompleted: this.criticalCompleted,
      blockedItems: this.blockedItems,
      overdueItems: this.overdueItems,
      progressByCategory: this.getProgressByCategory(),
      estimatedCompletionDate: this._targetLaunchDate,
      blockers,
    };
  }

  // ==========================================================================
  // Target Date Management
  // ==========================================================================

  /**
   * Set the target launch date
   */
  setTargetLaunchDate(date: string): void {
    if (isNaN(Date.parse(date))) {
      throw new DomainError(
        'Invalid date format',
        'INVALID_DATE',
        { date }
      );
    }

    this._targetLaunchDate = date;
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Clear the target launch date
   */
  clearTargetLaunchDate(): void {
    this._targetLaunchDate = undefined;
    this._lastUpdated = new Date().toISOString();
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object
   */
  toJSON(): LaunchChecklistType {
    return {
      id: this.id,
      name: this.name,
      items: this._items.map(item => item.toJSON()),
      overallProgress: this.overallProgress,
      readyForLaunch: this.readyForLaunch,
      targetLaunchDate: this._targetLaunchDate,
      lastUpdated: this._lastUpdated,
    };
  }

  toString(): string {
    return `LaunchChecklist(${this.id}, ${this.totalItems} items, ${this.overallProgress}% complete)`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a checklist item
 */
export function createChecklistItem(params: CreateChecklistItemParams): ValidationResult<ChecklistItemVO> {
  return ChecklistItemVO.create(params);
}

/**
 * Create a launch checklist
 */
export function createLaunchChecklist(params: CreateLaunchChecklistParams = {}): LaunchChecklistAggregate {
  return LaunchChecklistAggregate.create(params);
}

/**
 * Reconstitute a checklist item from data
 */
export function reconstituteChecklistItem(data: ChecklistItemType): ChecklistItemVO {
  return ChecklistItemVO.reconstitute(data);
}

/**
 * Reconstitute a launch checklist from data
 */
export function reconstituteLaunchChecklist(data: LaunchChecklistType): LaunchChecklistAggregate {
  return LaunchChecklistAggregate.reconstitute(data);
}
