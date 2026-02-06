/**
 * Documentation Service
 * @module services/DocumentationService
 *
 * Domain service for managing documentation pages. Orchestrates creation,
 * updates, publication, and retrieval of documentation content.
 *
 * TASK-FINAL-004: Documentation system service implementation
 */

import pino from 'pino';
import {
  DocPageEntity,
  createDocPage,
  reconstituteDocPage,
  Result,
  ValidationError,
  DomainError,
  type CreateDocPageParams,
  type DocPageData,
} from '../domain/documentation/index.js';
import type {
  DocPage,
  DocPageCategory,
  DocPageStatus,
  DocPageSummary,
  DocNavItem,
  DocTableOfContents,
} from '../types/documentation.js';

const logger = pino({ name: 'documentation-service' });

// ============================================================================
// Types
// ============================================================================

/**
 * DTO for creating a documentation page
 */
export interface CreateDocPageDTO {
  readonly title: string;
  readonly category: DocPageCategory;
  readonly content?: string;
  readonly slug?: string;
  readonly status?: DocPageStatus;
  readonly order?: number;
  readonly parentId?: string;
  readonly tags?: string[];
  readonly author?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * DTO for updating a documentation page
 */
export interface UpdateDocPageDTO {
  readonly title?: string;
  readonly content?: string;
  readonly category?: DocPageCategory;
  readonly status?: DocPageStatus;
  readonly order?: number;
  readonly parentId?: string | null;
  readonly tags?: string[];
  readonly author?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Filter options for listing pages
 */
export interface ListDocPagesFilter {
  readonly category?: DocPageCategory;
  readonly status?: DocPageStatus;
  readonly parentId?: string | null;
  readonly tags?: string[];
  readonly search?: string;
}

/**
 * Sort options for listing pages
 */
export interface ListDocPagesSort {
  readonly field: 'title' | 'lastUpdated' | 'createdAt' | 'order';
  readonly direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  readonly data: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
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

// ============================================================================
// Documentation Service Interface
// ============================================================================

/**
 * Documentation service interface
 */
export interface IDocumentationService {
  /**
   * Create a new documentation page
   */
  createPage(dto: CreateDocPageDTO): Promise<ServiceResult<DocPage>>;

  /**
   * Update an existing documentation page
   */
  updatePage(id: string, dto: UpdateDocPageDTO): Promise<ServiceResult<DocPage>>;

  /**
   * Get a single documentation page by ID
   */
  getPage(id: string): Promise<DocPage | null>;

  /**
   * Get a documentation page by slug
   */
  getPageBySlug(slug: string): Promise<DocPage | null>;

  /**
   * List documentation pages with optional filtering
   */
  listPages(
    filter?: ListDocPagesFilter,
    sort?: ListDocPagesSort,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<DocPageSummary>>;

  /**
   * Publish a documentation page
   */
  publishPage(id: string, publishedBy: string): Promise<ServiceResult<DocPage>>;

  /**
   * Unpublish a documentation page (return to draft)
   */
  unpublishPage(id: string): Promise<ServiceResult<DocPage>>;

  /**
   * Archive a documentation page
   */
  archivePage(id: string): Promise<ServiceResult<DocPage>>;

  /**
   * Restore an archived page
   */
  restorePage(id: string): Promise<ServiceResult<DocPage>>;

  /**
   * Delete a documentation page
   */
  deletePage(id: string): Promise<boolean>;

  /**
   * Get the table of contents for documentation
   */
  getTableOfContents(): Promise<DocTableOfContents>;

  /**
   * Reorder pages within a category
   */
  reorderPages(category: DocPageCategory, pageIds: string[]): Promise<ServiceResult<void>>;
}

// ============================================================================
// Documentation Service Implementation
// ============================================================================

/**
 * Documentation Service Implementation
 *
 * Manages documentation pages with in-memory storage (MVP).
 * Will be replaced with repository injection for production.
 */
export class DocumentationService implements IDocumentationService {
  /**
   * In-memory store for documentation pages (MVP - to be replaced with repository)
   */
  private pages: Map<string, DocPageEntity> = new Map();

  /**
   * Slug to ID index for fast lookup
   */
  private slugIndex: Map<string, string> = new Map();

  // ==========================================================================
  // Constructor
  // ==========================================================================

  constructor() {
    logger.info('DocumentationService initialized');
  }

  // ==========================================================================
  // Create Operations
  // ==========================================================================

  /**
   * Create a new documentation page
   */
  async createPage(dto: CreateDocPageDTO): Promise<ServiceResult<DocPage>> {
    logger.info({ dto: { title: dto.title, category: dto.category } }, 'Creating documentation page');

    try {
      // Check for duplicate slug
      const slug = dto.slug ?? DocPageEntity.generateSlug(dto.title);
      if (this.slugIndex.has(slug)) {
        return Result.err({
          code: 'DUPLICATE_SLUG',
          message: `A page with slug "${slug}" already exists`,
          context: { slug },
        });
      }

      // Create page via domain factory
      const createParams: CreateDocPageParams = {
        title: dto.title,
        category: dto.category,
        content: dto.content,
        slug: dto.slug,
        status: dto.status,
        order: dto.order,
        parentId: dto.parentId,
        tags: dto.tags,
        author: dto.author,
        metadata: dto.metadata,
      };

      const result = createDocPage(createParams);

      if (Result.isErr(result)) {
        const error = result.error;
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      const page = result.value;

      // Store page
      this.pages.set(page.id, page);
      this.slugIndex.set(page.slug, page.id);

      logger.info({ pageId: page.id, slug: page.slug }, 'Documentation page created');
      return Result.ok(page.toJSON());
    } catch (error) {
      logger.error({ error }, 'Failed to create documentation page');
      return Result.err({
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create page',
      });
    }
  }

  // ==========================================================================
  // Update Operations
  // ==========================================================================

  /**
   * Update an existing documentation page
   */
  async updatePage(id: string, dto: UpdateDocPageDTO): Promise<ServiceResult<DocPage>> {
    logger.info({ pageId: id, updates: Object.keys(dto) }, 'Updating documentation page');

    try {
      const page = this.pages.get(id);
      if (!page) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Page ${id} not found`,
          context: { pageId: id },
        });
      }

      // Apply updates
      if (dto.title !== undefined) {
        page.updateTitle(dto.title);
      }

      if (dto.content !== undefined) {
        page.updateContent(dto.content);
      }

      if (dto.category !== undefined) {
        page.updateCategory(dto.category);
      }

      if (dto.order !== undefined) {
        page.setOrder(dto.order);
      }

      if (dto.parentId !== undefined) {
        page.setParent(dto.parentId === null ? undefined : dto.parentId);
      }

      if (dto.tags !== undefined) {
        // Replace all tags
        const currentTags = page.tags;
        currentTags.forEach(tag => page.removeTag(tag));
        dto.tags.forEach(tag => page.addTag(tag));
      }

      if (dto.author !== undefined) {
        page.setAuthor(dto.author);
      }

      if (dto.metadata !== undefined) {
        Object.entries(dto.metadata).forEach(([key, value]) => {
          page.setMetadata(key, value);
        });
      }

      logger.info({ pageId: id }, 'Documentation page updated');
      return Result.ok(page.toJSON());
    } catch (error) {
      logger.error({ error, pageId: id }, 'Failed to update documentation page');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update page',
      });
    }
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  /**
   * Get a single documentation page by ID
   */
  async getPage(id: string): Promise<DocPage | null> {
    logger.debug({ pageId: id }, 'Getting documentation page');
    const page = this.pages.get(id);
    return page ? page.toJSON() : null;
  }

  /**
   * Get a documentation page by slug
   */
  async getPageBySlug(slug: string): Promise<DocPage | null> {
    logger.debug({ slug }, 'Getting documentation page by slug');
    const id = this.slugIndex.get(slug);
    if (!id) return null;
    const page = this.pages.get(id);
    return page ? page.toJSON() : null;
  }

  /**
   * List documentation pages with optional filtering
   */
  async listPages(
    filter?: ListDocPagesFilter,
    sort?: ListDocPagesSort,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<DocPageSummary>> {
    logger.debug({ filter, sort, pagination }, 'Listing documentation pages');

    let pages = Array.from(this.pages.values());

    // Apply filters
    if (filter) {
      if (filter.category) {
        pages = pages.filter(p => p.category === filter.category);
      }

      if (filter.status) {
        pages = pages.filter(p => p.status === filter.status);
      }

      if (filter.parentId !== undefined) {
        if (filter.parentId === null) {
          pages = pages.filter(p => p.parentId === undefined);
        } else {
          pages = pages.filter(p => p.parentId === filter.parentId);
        }
      }

      if (filter.tags && filter.tags.length > 0) {
        pages = pages.filter(p =>
          filter.tags!.some(tag => p.tags.includes(tag.toLowerCase()))
        );
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        pages = pages.filter(p =>
          p.title.toLowerCase().includes(searchLower) ||
          p.content.toLowerCase().includes(searchLower)
        );
      }
    }

    // Apply sorting
    const sortField = sort?.field ?? 'order';
    const sortDir = sort?.direction ?? 'asc';

    pages.sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      switch (sortField) {
        case 'title':
          aVal = a.title;
          bVal = b.title;
          break;
        case 'lastUpdated':
          aVal = a.lastUpdated;
          bVal = b.lastUpdated;
          break;
        case 'createdAt':
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
        case 'order':
        default:
          aVal = a.order ?? 9999;
          bVal = b.order ?? 9999;
          break;
      }

      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return sortDir === 'asc' ? 1 : -1;
      if (bVal === undefined) return sortDir === 'asc' ? -1 : 1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const total = pages.length;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const totalPages = Math.ceil(total / pageSize);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pagedData = pages.slice(start, end);

    return {
      data: pagedData.map(p => p.toSummary()),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // ==========================================================================
  // Status Transition Operations
  // ==========================================================================

  /**
   * Publish a documentation page
   */
  async publishPage(id: string, publishedBy: string): Promise<ServiceResult<DocPage>> {
    logger.info({ pageId: id, publishedBy }, 'Publishing documentation page');

    try {
      const page = this.pages.get(id);
      if (!page) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Page ${id} not found`,
          context: { pageId: id },
        });
      }

      page.publish(publishedBy);

      logger.info({ pageId: id }, 'Documentation page published');
      return Result.ok(page.toJSON());
    } catch (error) {
      logger.error({ error, pageId: id }, 'Failed to publish documentation page');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'PUBLISH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to publish page',
      });
    }
  }

  /**
   * Unpublish a documentation page (return to draft)
   */
  async unpublishPage(id: string): Promise<ServiceResult<DocPage>> {
    logger.info({ pageId: id }, 'Unpublishing documentation page');

    try {
      const page = this.pages.get(id);
      if (!page) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Page ${id} not found`,
          context: { pageId: id },
        });
      }

      page.unpublish();

      logger.info({ pageId: id }, 'Documentation page unpublished');
      return Result.ok(page.toJSON());
    } catch (error) {
      logger.error({ error, pageId: id }, 'Failed to unpublish documentation page');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'UNPUBLISH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to unpublish page',
      });
    }
  }

  /**
   * Archive a documentation page
   */
  async archivePage(id: string): Promise<ServiceResult<DocPage>> {
    logger.info({ pageId: id }, 'Archiving documentation page');

    try {
      const page = this.pages.get(id);
      if (!page) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Page ${id} not found`,
          context: { pageId: id },
        });
      }

      page.archive();

      logger.info({ pageId: id }, 'Documentation page archived');
      return Result.ok(page.toJSON());
    } catch (error) {
      logger.error({ error, pageId: id }, 'Failed to archive documentation page');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'ARCHIVE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to archive page',
      });
    }
  }

  /**
   * Restore an archived page
   */
  async restorePage(id: string): Promise<ServiceResult<DocPage>> {
    logger.info({ pageId: id }, 'Restoring documentation page');

    try {
      const page = this.pages.get(id);
      if (!page) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Page ${id} not found`,
          context: { pageId: id },
        });
      }

      page.restore();

      logger.info({ pageId: id }, 'Documentation page restored');
      return Result.ok(page.toJSON());
    } catch (error) {
      logger.error({ error, pageId: id }, 'Failed to restore documentation page');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'RESTORE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to restore page',
      });
    }
  }

  // ==========================================================================
  // Delete Operations
  // ==========================================================================

  /**
   * Delete a documentation page
   */
  async deletePage(id: string): Promise<boolean> {
    logger.info({ pageId: id }, 'Deleting documentation page');

    const page = this.pages.get(id);
    if (!page) {
      return false;
    }

    // Remove from indexes
    this.slugIndex.delete(page.slug);
    this.pages.delete(id);

    // Update children to have no parent
    for (const [, childPage] of this.pages) {
      if (childPage.parentId === id) {
        childPage.setParent(undefined);
      }
    }

    logger.info({ pageId: id }, 'Documentation page deleted');
    return true;
  }

  // ==========================================================================
  // Navigation Operations
  // ==========================================================================

  /**
   * Get the table of contents for documentation
   */
  async getTableOfContents(): Promise<DocTableOfContents> {
    logger.debug('Building table of contents');

    const categoryLabels: Record<string, string> = {
      'getting-started': 'Getting Started',
      'user-guide': 'User Guide',
      'api-reference': 'API Reference',
      'integration': 'Integrations',
      'tutorials': 'Tutorials',
      'troubleshooting': 'Troubleshooting',
      'support': 'Support',
      'release-notes': 'Release Notes',
    };

    const allPages = Array.from(this.pages.values())
      .filter(p => p.status === 'published')
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

    const categoryOrder: DocPageCategory[] = [
      'getting-started',
      'user-guide',
      'api-reference',
      'integration',
      'tutorials',
      'troubleshooting',
      'support',
      'release-notes',
    ];

    const categories = categoryOrder
      .map(category => {
        const categoryPages = allPages.filter(p => p.category === category);
        if (categoryPages.length === 0) return null;

        // Build navigation tree
        const rootPages = categoryPages.filter(p => !p.parentId);
        const items = this.buildNavItems(rootPages, categoryPages);

        return {
          category,
          label: categoryLabels[category] ?? category,
          items,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return {
      categories,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Build navigation items recursively
   */
  private buildNavItems(
    pages: DocPageEntity[],
    allPages: DocPageEntity[]
  ): DocNavItem[] {
    return pages.map(page => {
      const children = allPages.filter(p => p.parentId === page.id);

      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        order: page.order ?? 9999,
        children: children.length > 0
          ? this.buildNavItems(children, allPages)
          : undefined,
      };
    });
  }

  /**
   * Reorder pages within a category
   */
  async reorderPages(
    category: DocPageCategory,
    pageIds: string[]
  ): Promise<ServiceResult<void>> {
    logger.info({ category, pageIds }, 'Reordering documentation pages');

    try {
      // Validate all pages exist and belong to the category
      for (const [index, id] of pageIds.entries()) {
        const page = this.pages.get(id);
        if (!page) {
          return Result.err({
            code: 'NOT_FOUND',
            message: `Page ${id} not found`,
            context: { pageId: id },
          });
        }

        if (page.category !== category) {
          return Result.err({
            code: 'CATEGORY_MISMATCH',
            message: `Page ${id} is not in category ${category}`,
            context: { pageId: id, pageCategory: page.category, targetCategory: category },
          });
        }

        page.setOrder(index);
      }

      logger.info({ category }, 'Documentation pages reordered');
      return Result.ok(undefined);
    } catch (error) {
      logger.error({ error, category }, 'Failed to reorder documentation pages');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'REORDER_FAILED',
        message: error instanceof Error ? error.message : 'Failed to reorder pages',
      });
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new DocumentationService instance
 */
export function createDocumentationService(): IDocumentationService {
  return new DocumentationService();
}

// ============================================================================
// Singleton Instance
// ============================================================================

let documentationServiceInstance: IDocumentationService | null = null;

/**
 * Get the singleton DocumentationService instance
 */
export function getDocumentationService(): IDocumentationService {
  if (!documentationServiceInstance) {
    documentationServiceInstance = createDocumentationService();
  }
  return documentationServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetDocumentationService(): void {
  documentationServiceInstance = null;
}
