/**
 * Documentation Repository
 * @module repositories/DocumentationRepository
 *
 * Repository interface and in-memory implementation for documentation pages.
 * Supports TASK-FINAL-004 documentation system.
 *
 * Note: Documentation is primarily generated from code, not stored in database.
 * This in-memory implementation serves the MVP and caches generated docs.
 */

import pino from 'pino';
import {
  DocPage,
  DocPageCategory,
  DocPageStatus,
  DocPageSummary,
  DocNavItem,
  DocTableOfContents,
  createDocPage,
} from '../types/documentation.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Filter criteria for documentation pages
 */
export interface DocPageFilterCriteria {
  readonly category?: DocPageCategory;
  readonly status?: DocPageStatus;
  readonly parentId?: string | null;
  readonly tags?: string[];
  readonly search?: string;
}

/**
 * Create documentation page DTO
 */
export interface CreateDocPageDTO {
  readonly title: string;
  readonly slug?: string;
  readonly content?: string;
  readonly category: DocPageCategory;
  readonly status?: DocPageStatus;
  readonly order?: number;
  readonly parentId?: string;
  readonly tags?: string[];
  readonly author?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Update documentation page DTO
 */
export interface UpdateDocPageDTO {
  readonly title?: string;
  readonly slug?: string;
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
 * Pagination parameters for doc pages
 */
export interface DocPaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Paginated result for doc pages
 */
export interface DocPaginatedResult<T> {
  readonly data: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Documentation repository interface
 */
export interface IDocumentationRepository {
  /**
   * Find a page by ID
   */
  findById(id: string): Promise<DocPage | null>;

  /**
   * Find a page by slug
   */
  findBySlug(slug: string): Promise<DocPage | null>;

  /**
   * Find all pages matching optional filter
   */
  findAll(filter?: DocPageFilterCriteria): Promise<DocPage[]>;

  /**
   * Find pages with pagination
   */
  findPaginated(
    filter?: DocPageFilterCriteria,
    pagination?: DocPaginationParams
  ): Promise<DocPaginatedResult<DocPage>>;

  /**
   * Find page summaries (lighter weight for listings)
   */
  findSummaries(filter?: DocPageFilterCriteria): Promise<DocPageSummary[]>;

  /**
   * Find children of a parent page
   */
  findChildren(parentId: string): Promise<DocPage[]>;

  /**
   * Create a new page
   */
  create(dto: CreateDocPageDTO): Promise<DocPage>;

  /**
   * Update an existing page
   */
  update(id: string, dto: UpdateDocPageDTO): Promise<DocPage | null>;

  /**
   * Delete a page
   */
  delete(id: string): Promise<boolean>;

  /**
   * Get table of contents structure
   */
  getTableOfContents(): Promise<DocTableOfContents>;

  /**
   * Check if a slug exists
   */
  slugExists(slug: string, excludeId?: string): Promise<boolean>;

  /**
   * Get page count by category
   */
  getCountByCategory(): Promise<Record<DocPageCategory, number>>;

  /**
   * Bulk upsert pages (for sync operations)
   */
  bulkUpsert(pages: CreateDocPageDTO[]): Promise<{ inserted: number; updated: number }>;

  /**
   * Clear all pages (for cache refresh)
   */
  clear(): Promise<void>;
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

/**
 * In-memory documentation repository implementation
 *
 * This implementation serves the MVP where documentation is generated
 * from code rather than stored in a database. It provides caching
 * and is designed for easy migration to database-backed storage.
 */
export class InMemoryDocumentationRepository implements IDocumentationRepository {
  private pages: Map<string, DocPage> = new Map();
  private slugIndex: Map<string, string> = new Map(); // slug -> id
  private readonly logger: pino.Logger;

  constructor() {
    this.logger = pino({ name: 'repository:documentation' });
  }

  async findById(id: string): Promise<DocPage | null> {
    this.logger.debug({ id }, 'Finding page by ID');
    return this.pages.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<DocPage | null> {
    this.logger.debug({ slug }, 'Finding page by slug');
    const id = this.slugIndex.get(slug);
    if (!id) return null;
    return this.pages.get(id) ?? null;
  }

  async findAll(filter?: DocPageFilterCriteria): Promise<DocPage[]> {
    this.logger.debug({ filter }, 'Finding all pages');
    let pages = Array.from(this.pages.values());

    if (filter) {
      pages = this.applyFilter(pages, filter);
    }

    // Sort by order, then by title
    return pages.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
  }

  async findPaginated(
    filter?: DocPageFilterCriteria,
    pagination?: DocPaginationParams
  ): Promise<DocPaginatedResult<DocPage>> {
    const allPages = await this.findAll(filter);
    const total = allPages.length;

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const data = allPages.slice(offset, offset + pageSize);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findSummaries(filter?: DocPageFilterCriteria): Promise<DocPageSummary[]> {
    const pages = await this.findAll(filter);
    return pages.map(page => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      category: page.category,
      status: page.status,
      order: page.order,
      lastUpdated: page.lastUpdated,
    }));
  }

  async findChildren(parentId: string): Promise<DocPage[]> {
    this.logger.debug({ parentId }, 'Finding children');
    const children = Array.from(this.pages.values())
      .filter(p => p.parentId === parentId)
      .sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        return orderA - orderB;
      });
    return children;
  }

  async create(dto: CreateDocPageDTO): Promise<DocPage> {
    this.logger.debug({ title: dto.title }, 'Creating page');

    const id = crypto.randomUUID();
    const slug = dto.slug ?? this.generateSlug(dto.title);
    const now = new Date().toISOString();

    const page: DocPage = {
      id,
      title: dto.title,
      slug,
      content: dto.content ?? '',
      category: dto.category,
      status: dto.status ?? DocPageStatus.DRAFT,
      order: dto.order,
      parentId: dto.parentId,
      tags: dto.tags,
      author: dto.author,
      lastUpdated: now,
      createdAt: now,
      metadata: dto.metadata,
    };

    this.pages.set(id, page);
    this.slugIndex.set(slug, id);

    this.logger.info({ id, slug }, 'Page created');
    return page;
  }

  async update(id: string, dto: UpdateDocPageDTO): Promise<DocPage | null> {
    this.logger.debug({ id }, 'Updating page');

    const existing = this.pages.get(id);
    if (!existing) {
      this.logger.warn({ id }, 'Page not found for update');
      return null;
    }

    // Handle slug change
    if (dto.slug && dto.slug !== existing.slug) {
      this.slugIndex.delete(existing.slug);
      this.slugIndex.set(dto.slug, id);
    }

    const updated: DocPage = {
      ...existing,
      ...dto,
      id, // Ensure ID cannot be changed
      lastUpdated: new Date().toISOString(),
      createdAt: existing.createdAt, // Preserve creation date
    };

    this.pages.set(id, updated);
    this.logger.info({ id }, 'Page updated');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    this.logger.debug({ id }, 'Deleting page');

    const page = this.pages.get(id);
    if (!page) {
      this.logger.warn({ id }, 'Page not found for deletion');
      return false;
    }

    this.slugIndex.delete(page.slug);
    this.pages.delete(id);

    this.logger.info({ id }, 'Page deleted');
    return true;
  }

  async getTableOfContents(): Promise<DocTableOfContents> {
    this.logger.debug('Building table of contents');

    const pages = await this.findAll({ status: DocPageStatus.PUBLISHED });
    const categoryGroups = new Map<DocPageCategory, DocPage[]>();

    // Group by category
    for (const page of pages) {
      if (!categoryGroups.has(page.category)) {
        categoryGroups.set(page.category, []);
      }
      categoryGroups.get(page.category)!.push(page);
    }

    // Build navigation structure
    const categories = Array.from(categoryGroups.entries()).map(([category, categoryPages]) => {
      // Build tree structure for this category
      const rootPages = categoryPages.filter(p => !p.parentId);
      const items = rootPages.map(page => this.buildNavItem(page, categoryPages));

      return {
        category,
        label: this.categoryToLabel(category),
        items,
      };
    });

    return {
      categories,
      lastUpdated: new Date().toISOString(),
    };
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const id = this.slugIndex.get(slug);
    if (!id) return false;
    if (excludeId && id === excludeId) return false;
    return true;
  }

  async getCountByCategory(): Promise<Record<DocPageCategory, number>> {
    const counts: Record<string, number> = {};

    for (const category of Object.values(DocPageCategory)) {
      counts[category] = 0;
    }

    for (const page of this.pages.values()) {
      counts[page.category] = (counts[page.category] || 0) + 1;
    }

    return counts as Record<DocPageCategory, number>;
  }

  async bulkUpsert(pages: CreateDocPageDTO[]): Promise<{ inserted: number; updated: number }> {
    this.logger.debug({ count: pages.length }, 'Bulk upserting pages');

    let inserted = 0;
    let updated = 0;

    for (const dto of pages) {
      const slug = dto.slug ?? this.generateSlug(dto.title);
      const existingId = this.slugIndex.get(slug);

      if (existingId) {
        await this.update(existingId, dto);
        updated++;
      } else {
        await this.create({ ...dto, slug });
        inserted++;
      }
    }

    this.logger.info({ inserted, updated }, 'Bulk upsert completed');
    return { inserted, updated };
  }

  async clear(): Promise<void> {
    this.logger.info('Clearing all pages');
    this.pages.clear();
    this.slugIndex.clear();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private applyFilter(pages: DocPage[], filter: DocPageFilterCriteria): DocPage[] {
    return pages.filter(page => {
      if (filter.category && page.category !== filter.category) {
        return false;
      }

      if (filter.status && page.status !== filter.status) {
        return false;
      }

      if (filter.parentId !== undefined) {
        if (filter.parentId === null && page.parentId) {
          return false;
        }
        if (filter.parentId !== null && page.parentId !== filter.parentId) {
          return false;
        }
      }

      if (filter.tags && filter.tags.length > 0) {
        const pageTags = page.tags ?? [];
        const hasAllTags = filter.tags.every(tag => pageTags.includes(tag));
        if (!hasAllTags) return false;
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const titleMatch = page.title.toLowerCase().includes(searchLower);
        const contentMatch = page.content.toLowerCase().includes(searchLower);
        const tagMatch = (page.tags ?? []).some(tag =>
          tag.toLowerCase().includes(searchLower)
        );
        if (!titleMatch && !contentMatch && !tagMatch) {
          return false;
        }
      }

      return true;
    });
  }

  private generateSlug(title: string): string {
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Ensure uniqueness
    let counter = 1;
    let finalSlug = slug;
    while (this.slugIndex.has(finalSlug)) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    return finalSlug;
  }

  private buildNavItem(page: DocPage, allPages: DocPage[]): DocNavItem {
    const children = allPages
      .filter(p => p.parentId === page.id)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .map(child => this.buildNavItem(child, allPages));

    const item: DocNavItem = {
      id: page.id,
      title: page.title,
      slug: page.slug,
      order: page.order ?? 0,
    };

    if (children.length > 0) {
      (item as any).children = children;
    }

    return item;
  }

  private categoryToLabel(category: DocPageCategory): string {
    const labels: Record<DocPageCategory, string> = {
      'user-guide': 'User Guide',
      'api-reference': 'API Reference',
      'integration': 'Integrations',
      'support': 'Support',
      'getting-started': 'Getting Started',
      'tutorials': 'Tutorials',
      'troubleshooting': 'Troubleshooting',
      'release-notes': 'Release Notes',
    };
    return labels[category] || category;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a documentation repository instance
 */
export function createDocumentationRepository(): IDocumentationRepository {
  return new InMemoryDocumentationRepository();
}
