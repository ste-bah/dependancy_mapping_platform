/**
 * Documentation Page Entity
 * @module domain/documentation/DocPage
 *
 * Aggregate root for documentation pages. Manages content, metadata,
 * and lifecycle states for documentation in the system.
 *
 * TASK-FINAL-004: Documentation system domain implementation
 */

import { randomUUID } from 'crypto';
import {
  DocPage as DocPageType,
  DocPageCategory,
  DocPageStatus,
  DocPageSummary,
} from '../../types/documentation.js';
import { Result, ValidationResult, ValidationError, DomainError } from './result.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for creating a new documentation page
 */
export interface CreateDocPageParams {
  title: string;
  category: DocPageCategory;
  content?: string;
  slug?: string;
  status?: DocPageStatus;
  order?: number;
  parentId?: string;
  tags?: string[];
  author?: string;
  metadata?: Record<string, unknown>;
  id?: string;
}

/**
 * Parameters for reconstituting a page from persistence
 */
export interface DocPageData {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: DocPageCategory;
  status?: DocPageStatus;
  order?: number;
  parentId?: string;
  tags?: string[];
  author?: string;
  lastUpdated: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Documentation Page Entity
// ============================================================================

/**
 * Documentation Page Aggregate Root
 *
 * Represents a single documentation page with content, metadata, and lifecycle.
 * Enforces domain invariants such as valid titles, slugs, and status transitions.
 *
 * @example
 * ```typescript
 * const result = DocPageEntity.create({
 *   title: 'Getting Started',
 *   category: 'getting-started',
 *   content: '# Getting Started\n\nWelcome to the documentation.',
 * });
 *
 * if (Result.isOk(result)) {
 *   result.value.publish('admin@example.com');
 * }
 * ```
 */
export class DocPageEntity implements DocPageType {
  /** Unique page identifier (immutable) */
  public readonly id: string;

  /** Page title */
  private _title: string;

  /** URL-friendly slug */
  private _slug: string;

  /** Page content in markdown format */
  private _content: string;

  /** Documentation category */
  private _category: DocPageCategory;

  /** Publication status */
  private _status: DocPageStatus;

  /** Display order within category */
  private _order?: number;

  /** Parent page ID for nested pages */
  private _parentId?: string;

  /** Searchable tags */
  private _tags: string[];

  /** Author name or ID */
  private _author?: string;

  /** Last modification timestamp */
  private _lastUpdated: string;

  /** Creation timestamp */
  private _createdAt: string;

  /** Additional metadata */
  private _metadata: Record<string, unknown>;

  // ==========================================================================
  // Private Constructor
  // ==========================================================================

  private constructor(data: DocPageData) {
    this.id = data.id;
    this._title = data.title;
    this._slug = data.slug;
    this._content = data.content;
    this._category = data.category;
    this._status = data.status ?? 'draft';
    this._order = data.order;
    this._parentId = data.parentId;
    this._tags = data.tags ?? [];
    this._author = data.author;
    this._lastUpdated = data.lastUpdated;
    this._createdAt = data.createdAt ?? data.lastUpdated;
    this._metadata = data.metadata ?? {};
  }

  // ==========================================================================
  // Getters (Read-Only Access)
  // ==========================================================================

  get title(): string {
    return this._title;
  }

  get slug(): string {
    return this._slug;
  }

  get content(): string {
    return this._content;
  }

  get category(): DocPageCategory {
    return this._category;
  }

  get status(): DocPageStatus {
    return this._status;
  }

  get order(): number | undefined {
    return this._order;
  }

  get parentId(): string | undefined {
    return this._parentId;
  }

  get tags(): string[] {
    return [...this._tags];
  }

  get author(): string | undefined {
    return this._author;
  }

  get lastUpdated(): string {
    return this._lastUpdated;
  }

  get createdAt(): string {
    return this._createdAt;
  }

  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if page is published
   */
  get isPublished(): boolean {
    return this._status === 'published';
  }

  /**
   * Check if page is in draft state
   */
  get isDraft(): boolean {
    return this._status === 'draft';
  }

  /**
   * Check if page is archived
   */
  get isArchived(): boolean {
    return this._status === 'archived';
  }

  /**
   * Get word count of content
   */
  get wordCount(): number {
    return this._content.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Check if page has parent (nested)
   */
  get isNested(): boolean {
    return this._parentId !== undefined;
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new documentation page with validation
   *
   * @param params - Creation parameters
   * @returns Result containing the entity or validation error
   */
  static create(params: CreateDocPageParams): ValidationResult<DocPageEntity> {
    // Validate title
    if (!params.title || typeof params.title !== 'string') {
      return Result.err(ValidationError.required('title'));
    }

    const trimmedTitle = params.title.trim();
    if (trimmedTitle.length === 0) {
      return Result.err(
        ValidationError.invalidValue('title', params.title, 'Title cannot be empty')
      );
    }

    if (trimmedTitle.length > 200) {
      return Result.err(
        ValidationError.outOfRange('title', 1, 200)
      );
    }

    // Validate category
    const validCategories: DocPageCategory[] = [
      'user-guide', 'api-reference', 'integration', 'support',
      'getting-started', 'tutorials', 'troubleshooting', 'release-notes',
    ];

    if (!params.category || !validCategories.includes(params.category)) {
      return Result.err(
        ValidationError.invalidValue('category', params.category, `Must be one of: ${validCategories.join(', ')}`)
      );
    }

    // Generate or validate slug
    const slug = params.slug ?? DocPageEntity.generateSlug(trimmedTitle);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return Result.err(
        ValidationError.invalidFormat('slug', 'lowercase alphanumeric with hyphens')
      );
    }

    // Validate order if provided
    if (params.order !== undefined && (params.order < 0 || !Number.isInteger(params.order))) {
      return Result.err(
        ValidationError.invalidValue('order', params.order, 'Must be a non-negative integer')
      );
    }

    const now = new Date().toISOString();
    const id = params.id ?? randomUUID();

    return Result.ok(
      new DocPageEntity({
        id,
        title: trimmedTitle,
        slug,
        content: params.content ?? '',
        category: params.category,
        status: params.status ?? 'draft',
        order: params.order,
        parentId: params.parentId,
        tags: params.tags ?? [],
        author: params.author,
        lastUpdated: now,
        createdAt: now,
        metadata: params.metadata ?? {},
      })
    );
  }

  /**
   * Reconstitute from persisted data (no validation, trusted source)
   *
   * @param data - Persisted page data
   * @returns DocPageEntity instance
   */
  static reconstitute(data: DocPageData): DocPageEntity {
    return new DocPageEntity(data);
  }

  /**
   * Generate a URL-friendly slug from a title
   *
   * @param title - The page title
   * @returns URL-friendly slug
   */
  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ==========================================================================
  // Domain Behavior Methods
  // ==========================================================================

  /**
   * Update the page content
   *
   * @param content - New content in markdown format
   */
  updateContent(content: string): void {
    if (this._status === 'archived') {
      throw new DomainError(
        'Cannot update archived page',
        'PAGE_ARCHIVED',
        { pageId: this.id }
      );
    }

    this._content = content;
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Update the page title and optionally regenerate slug
   *
   * @param title - New title
   * @param regenerateSlug - Whether to regenerate the slug (default: false)
   */
  updateTitle(title: string, regenerateSlug: boolean = false): void {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      throw new DomainError(
        'Title cannot be empty',
        'INVALID_TITLE',
        { title }
      );
    }

    if (trimmedTitle.length > 200) {
      throw new DomainError(
        'Title exceeds maximum length of 200 characters',
        'TITLE_TOO_LONG',
        { length: trimmedTitle.length, max: 200 }
      );
    }

    this._title = trimmedTitle;
    if (regenerateSlug) {
      this._slug = DocPageEntity.generateSlug(trimmedTitle);
    }
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Update the page category
   *
   * @param category - New category
   */
  updateCategory(category: DocPageCategory): void {
    this._category = category;
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Set the display order
   *
   * @param order - Display order (non-negative integer)
   */
  setOrder(order: number): void {
    if (order < 0 || !Number.isInteger(order)) {
      throw new DomainError(
        'Order must be a non-negative integer',
        'INVALID_ORDER',
        { order }
      );
    }

    this._order = order;
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Set the parent page for nesting
   *
   * @param parentId - Parent page ID or undefined to un-nest
   */
  setParent(parentId: string | undefined): void {
    if (parentId === this.id) {
      throw new DomainError(
        'Page cannot be its own parent',
        'CIRCULAR_REFERENCE',
        { pageId: this.id }
      );
    }

    this._parentId = parentId;
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Add a tag to the page
   *
   * @param tag - Tag to add
   */
  addTag(tag: string): void {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !this._tags.includes(normalizedTag)) {
      this._tags.push(normalizedTag);
      this._lastUpdated = new Date().toISOString();
    }
  }

  /**
   * Remove a tag from the page
   *
   * @param tag - Tag to remove
   * @returns True if tag was removed
   */
  removeTag(tag: string): boolean {
    const normalizedTag = tag.trim().toLowerCase();
    const index = this._tags.indexOf(normalizedTag);
    if (index > -1) {
      this._tags.splice(index, 1);
      this._lastUpdated = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Set the author
   *
   * @param author - Author name or ID
   */
  setAuthor(author: string): void {
    this._author = author;
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Set metadata value
   *
   * @param key - Metadata key
   * @param value - Metadata value
   */
  setMetadata(key: string, value: unknown): void {
    this._metadata[key] = value;
    this._lastUpdated = new Date().toISOString();
  }

  // ==========================================================================
  // Status Transition Methods
  // ==========================================================================

  /**
   * Submit page for review
   */
  submitForReview(): void {
    if (this._status !== 'draft') {
      throw new DomainError(
        'Only draft pages can be submitted for review',
        'INVALID_STATUS_TRANSITION',
        { currentStatus: this._status, targetStatus: 'review' }
      );
    }

    if (this._content.trim().length === 0) {
      throw new DomainError(
        'Cannot submit empty page for review',
        'EMPTY_CONTENT',
        { pageId: this.id }
      );
    }

    this._status = 'review';
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Publish the page
   *
   * @param publishedBy - User who published (optional)
   */
  publish(publishedBy?: string): void {
    if (this._status === 'archived') {
      throw new DomainError(
        'Cannot publish archived page',
        'INVALID_STATUS_TRANSITION',
        { currentStatus: this._status, targetStatus: 'published' }
      );
    }

    if (this._content.trim().length === 0) {
      throw new DomainError(
        'Cannot publish empty page',
        'EMPTY_CONTENT',
        { pageId: this.id }
      );
    }

    this._status = 'published';
    this._lastUpdated = new Date().toISOString();
    if (publishedBy) {
      this._metadata.publishedBy = publishedBy;
      this._metadata.publishedAt = this._lastUpdated;
    }
  }

  /**
   * Return page to draft status
   */
  unpublish(): void {
    if (this._status === 'archived') {
      throw new DomainError(
        'Cannot unpublish archived page',
        'INVALID_STATUS_TRANSITION',
        { currentStatus: this._status, targetStatus: 'draft' }
      );
    }

    this._status = 'draft';
    this._lastUpdated = new Date().toISOString();
  }

  /**
   * Archive the page
   */
  archive(): void {
    if (this._status === 'archived') {
      return; // Already archived, no-op
    }

    this._status = 'archived';
    this._lastUpdated = new Date().toISOString();
    this._metadata.archivedAt = this._lastUpdated;
  }

  /**
   * Restore archived page to draft
   */
  restore(): void {
    if (this._status !== 'archived') {
      throw new DomainError(
        'Only archived pages can be restored',
        'INVALID_STATUS_TRANSITION',
        { currentStatus: this._status, targetStatus: 'draft' }
      );
    }

    this._status = 'draft';
    this._lastUpdated = new Date().toISOString();
    delete this._metadata.archivedAt;
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object for serialization
   *
   * @returns Plain object representation matching DocPage type
   */
  toJSON(): DocPageType {
    return {
      id: this.id,
      title: this._title,
      slug: this._slug,
      content: this._content,
      category: this._category,
      status: this._status,
      order: this._order,
      parentId: this._parentId,
      tags: [...this._tags],
      author: this._author,
      lastUpdated: this._lastUpdated,
      createdAt: this._createdAt,
      metadata: { ...this._metadata },
    };
  }

  /**
   * Convert to summary object for listings
   *
   * @returns Summary representation
   */
  toSummary(): DocPageSummary {
    return {
      id: this.id,
      title: this._title,
      slug: this._slug,
      category: this._category,
      status: this._status,
      order: this._order,
      lastUpdated: this._lastUpdated,
    };
  }

  /**
   * Check equality with another page (by ID)
   *
   * @param other - Other page to compare
   * @returns True if same page (same ID)
   */
  equals(other: DocPageEntity): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return this.id === other.id;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `DocPage(${this.id}, "${this._title}", ${this._category}, ${this._status})`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a documentation page from creation parameters
 *
 * @param params - Creation parameters
 * @returns Result containing DocPageEntity or validation error
 */
export function createDocPage(params: CreateDocPageParams): ValidationResult<DocPageEntity> {
  return DocPageEntity.create(params);
}

/**
 * Reconstitute a documentation page from persisted data
 *
 * @param data - Persisted page data
 * @returns DocPageEntity instance
 */
export function reconstituteDocPage(data: DocPageData): DocPageEntity {
  return DocPageEntity.reconstitute(data);
}
