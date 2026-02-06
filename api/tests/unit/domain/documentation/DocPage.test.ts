/**
 * DocPageEntity Unit Tests
 * @module tests/unit/domain/documentation/DocPage
 *
 * Tests for the DocPageEntity domain entity including:
 * - Creation and validation
 * - Slug generation
 * - Content updates
 * - Status transitions (draft -> review -> published -> archived)
 * - Tag management
 * - Serialization
 *
 * TASK-FINAL-004: Documentation system testing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DocPageEntity,
  createDocPage,
  reconstituteDocPage,
  Result,
  ValidationError,
  DomainError,
} from '../../../../src/domain/documentation/index.js';
import type { CreateDocPageParams, DocPageData } from '../../../../src/domain/documentation/index.js';
import type { DocPageCategory, DocPageStatus } from '../../../../src/types/documentation.js';

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create valid default parameters for DocPage creation
 */
function createValidParams(overrides: Partial<CreateDocPageParams> = {}): CreateDocPageParams {
  return {
    title: 'Getting Started Guide',
    category: 'getting-started' as DocPageCategory,
    content: '# Getting Started\n\nWelcome to the documentation.',
    ...overrides,
  };
}

/**
 * Create valid DocPageData for reconstitution
 */
function createValidData(overrides: Partial<DocPageData> = {}): DocPageData {
  const now = new Date().toISOString();
  return {
    id: 'test-page-id-123',
    title: 'Test Page',
    slug: 'test-page',
    content: '# Test Page\n\nTest content.',
    category: 'user-guide' as DocPageCategory,
    status: 'draft' as DocPageStatus,
    lastUpdated: now,
    createdAt: now,
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('DocPageEntity', () => {
  // ==========================================================================
  // Creation Tests
  // ==========================================================================

  describe('create', () => {
    it('should create a doc page with valid data', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.title).toBe('Test Page');
        expect(result.value.category).toBe('user-guide');
        expect(result.value.status).toBe('draft');
        expect(result.value.id).toBeDefined();
      }
    });

    it('should generate slug from title', () => {
      const result = createDocPage({
        title: 'Getting Started Guide',
        category: 'getting-started',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.slug).toBe('getting-started-guide');
      }
    });

    it('should handle special characters in slug generation', () => {
      const result = createDocPage({
        title: "What's New in 2024?",
        category: 'release-notes',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.slug).toBe('what-s-new-in-2024');
      }
    });

    it('should accept custom slug', () => {
      const result = createDocPage({
        title: 'Getting Started Guide',
        category: 'getting-started',
        slug: 'custom-slug',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.slug).toBe('custom-slug');
      }
    });

    it('should reject empty title', () => {
      const result = createDocPage({
        title: '',
        category: 'user-guide',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.code).toBe('REQUIRED_FIELD');
        expect(result.error.field).toBe('title');
      }
    });

    it('should reject whitespace-only title', () => {
      const result = createDocPage({
        title: '   ',
        category: 'user-guide',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_VALUE');
      }
    });

    it('should reject title exceeding 200 characters', () => {
      const longTitle = 'A'.repeat(201);
      const result = createDocPage({
        title: longTitle,
        category: 'user-guide',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OUT_OF_RANGE');
        expect(result.error.field).toBe('title');
      }
    });

    it('should reject invalid category', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'invalid-category' as DocPageCategory,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_VALUE');
        expect(result.error.field).toBe('category');
      }
    });

    it('should accept all valid categories', () => {
      const validCategories: DocPageCategory[] = [
        'user-guide',
        'api-reference',
        'integration',
        'support',
        'getting-started',
        'tutorials',
        'troubleshooting',
        'release-notes',
      ];

      for (const category of validCategories) {
        const result = createDocPage({
          title: `Test ${category}`,
          category,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.category).toBe(category);
        }
      }
    });

    it('should reject invalid slug format', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        slug: 'Invalid Slug!',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_FORMAT');
        expect(result.error.field).toBe('slug');
      }
    });

    it('should reject negative order value', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        order: -1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_VALUE');
        expect(result.error.field).toBe('order');
      }
    });

    it('should reject non-integer order value', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        order: 1.5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_VALUE');
        expect(result.error.field).toBe('order');
      }
    });

    it('should accept zero order value', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        order: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.order).toBe(0);
      }
    });

    it('should set default empty content', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.content).toBe('');
      }
    });

    it('should set timestamps on creation', () => {
      const beforeCreate = new Date().toISOString();
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });
      const afterCreate = new Date().toISOString();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.createdAt).toBeDefined();
        expect(result.value.lastUpdated).toBeDefined();
        expect(result.value.createdAt >= beforeCreate).toBe(true);
        expect(result.value.lastUpdated <= afterCreate).toBe(true);
      }
    });

    it('should accept all optional parameters', () => {
      const result = createDocPage({
        title: 'Complete Page',
        category: 'tutorials',
        content: '# Tutorial\n\nStep by step guide.',
        slug: 'complete-tutorial',
        status: 'review',
        order: 5,
        parentId: 'parent-page-id',
        tags: ['tutorial', 'beginner'],
        author: 'author@example.com',
        metadata: { reviewedBy: 'reviewer@example.com' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.content).toBe('# Tutorial\n\nStep by step guide.');
        expect(result.value.slug).toBe('complete-tutorial');
        expect(result.value.status).toBe('review');
        expect(result.value.order).toBe(5);
        expect(result.value.parentId).toBe('parent-page-id');
        expect(result.value.tags).toEqual(['tutorial', 'beginner']);
        expect(result.value.author).toBe('author@example.com');
        expect(result.value.metadata).toEqual({ reviewedBy: 'reviewer@example.com' });
      }
    });
  });

  // ==========================================================================
  // Reconstitution Tests
  // ==========================================================================

  describe('reconstitute', () => {
    it('should reconstitute from valid data', () => {
      const data = createValidData();
      const page = reconstituteDocPage(data);

      expect(page.id).toBe(data.id);
      expect(page.title).toBe(data.title);
      expect(page.slug).toBe(data.slug);
      expect(page.content).toBe(data.content);
      expect(page.category).toBe(data.category);
      expect(page.status).toBe(data.status);
    });

    it('should preserve all optional fields', () => {
      const data = createValidData({
        order: 10,
        parentId: 'parent-id',
        tags: ['tag1', 'tag2'],
        author: 'author@test.com',
        metadata: { key: 'value' },
      });

      const page = reconstituteDocPage(data);

      expect(page.order).toBe(10);
      expect(page.parentId).toBe('parent-id');
      expect(page.tags).toEqual(['tag1', 'tag2']);
      expect(page.author).toBe('author@test.com');
      expect(page.metadata).toEqual({ key: 'value' });
    });
  });

  // ==========================================================================
  // Computed Properties Tests
  // ==========================================================================

  describe('computed properties', () => {
    it('should correctly identify published status', () => {
      const draftPage = reconstituteDocPage(createValidData({ status: 'draft' }));
      const publishedPage = reconstituteDocPage(createValidData({ status: 'published' }));

      expect(draftPage.isPublished).toBe(false);
      expect(publishedPage.isPublished).toBe(true);
    });

    it('should correctly identify draft status', () => {
      const draftPage = reconstituteDocPage(createValidData({ status: 'draft' }));
      const publishedPage = reconstituteDocPage(createValidData({ status: 'published' }));

      expect(draftPage.isDraft).toBe(true);
      expect(publishedPage.isDraft).toBe(false);
    });

    it('should correctly identify archived status', () => {
      const archivedPage = reconstituteDocPage(createValidData({ status: 'archived' }));
      const draftPage = reconstituteDocPage(createValidData({ status: 'draft' }));

      expect(archivedPage.isArchived).toBe(true);
      expect(draftPage.isArchived).toBe(false);
    });

    it('should calculate word count correctly', () => {
      const page = reconstituteDocPage(
        createValidData({ content: 'This is a test page with eight words here.' })
      );

      expect(page.wordCount).toBe(9);
    });

    it('should return zero for empty content word count', () => {
      const page = reconstituteDocPage(createValidData({ content: '' }));

      expect(page.wordCount).toBe(0);
    });

    it('should correctly identify nested pages', () => {
      const nestedPage = reconstituteDocPage(createValidData({ parentId: 'parent-id' }));
      const topLevelPage = reconstituteDocPage(createValidData());

      expect(nestedPage.isNested).toBe(true);
      expect(topLevelPage.isNested).toBe(false);
    });
  });

  // ==========================================================================
  // Content Update Tests
  // ==========================================================================

  describe('updateContent', () => {
    it('should update content successfully', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        content: 'Original content',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;
        const originalTimestamp = page.lastUpdated;

        // Small delay to ensure timestamp changes
        page.updateContent('Updated content');

        expect(page.content).toBe('Updated content');
        expect(page.lastUpdated >= originalTimestamp).toBe(true);
      }
    });

    it('should throw error when updating archived page content', () => {
      const page = reconstituteDocPage(createValidData({ status: 'archived' }));

      expect(() => page.updateContent('New content')).toThrow(DomainError);
      expect(() => page.updateContent('New content')).toThrow('Cannot update archived page');
    });
  });

  // ==========================================================================
  // Title Update Tests
  // ==========================================================================

  describe('updateTitle', () => {
    it('should update title without regenerating slug', () => {
      const result = createDocPage({
        title: 'Original Title',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;
        const originalSlug = page.slug;

        page.updateTitle('New Title');

        expect(page.title).toBe('New Title');
        expect(page.slug).toBe(originalSlug);
      }
    });

    it('should update title and regenerate slug when requested', () => {
      const result = createDocPage({
        title: 'Original Title',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        page.updateTitle('New Title', true);

        expect(page.title).toBe('New Title');
        expect(page.slug).toBe('new-title');
      }
    });

    it('should throw error for empty title', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        expect(() => page.updateTitle('')).toThrow(DomainError);
        expect(() => page.updateTitle('   ')).toThrow(DomainError);
      }
    });

    it('should throw error for title exceeding max length', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;
        const longTitle = 'A'.repeat(201);

        expect(() => page.updateTitle(longTitle)).toThrow(DomainError);
      }
    });
  });

  // ==========================================================================
  // Category Update Tests
  // ==========================================================================

  describe('updateCategory', () => {
    it('should update category', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        page.updateCategory('tutorials');

        expect(page.category).toBe('tutorials');
      }
    });
  });

  // ==========================================================================
  // Order Management Tests
  // ==========================================================================

  describe('setOrder', () => {
    it('should set valid order', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        page.setOrder(5);

        expect(page.order).toBe(5);
      }
    });

    it('should throw error for negative order', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        expect(() => page.setOrder(-1)).toThrow(DomainError);
      }
    });

    it('should throw error for non-integer order', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        expect(() => page.setOrder(1.5)).toThrow(DomainError);
      }
    });
  });

  // ==========================================================================
  // Parent Management Tests
  // ==========================================================================

  describe('setParent', () => {
    it('should set parent ID', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        page.setParent('parent-id');

        expect(page.parentId).toBe('parent-id');
        expect(page.isNested).toBe(true);
      }
    });

    it('should remove parent when set to undefined', () => {
      const page = reconstituteDocPage(createValidData({ parentId: 'parent-id' }));

      page.setParent(undefined);

      expect(page.parentId).toBeUndefined();
      expect(page.isNested).toBe(false);
    });

    it('should throw error for circular reference', () => {
      const page = reconstituteDocPage(createValidData({ id: 'page-id' }));

      expect(() => page.setParent('page-id')).toThrow(DomainError);
      expect(() => page.setParent('page-id')).toThrow('Page cannot be its own parent');
    });
  });

  // ==========================================================================
  // Tag Management Tests
  // ==========================================================================

  describe('tag management', () => {
    it('should add tag', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        page.addTag('new-tag');

        expect(page.tags).toContain('new-tag');
      }
    });

    it('should normalize tag to lowercase', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        page.addTag('UPPERCASE');

        expect(page.tags).toContain('uppercase');
      }
    });

    it('should not add duplicate tags', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        tags: ['existing'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        page.addTag('existing');

        expect(page.tags.filter(t => t === 'existing').length).toBe(1);
      }
    });

    it('should remove existing tag', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        tags: ['tag-to-remove', 'other-tag'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        const removed = page.removeTag('tag-to-remove');

        expect(removed).toBe(true);
        expect(page.tags).not.toContain('tag-to-remove');
        expect(page.tags).toContain('other-tag');
      }
    });

    it('should return false when removing non-existent tag', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        tags: ['existing-tag'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;

        const removed = page.removeTag('non-existent');

        expect(removed).toBe(false);
      }
    });
  });

  // ==========================================================================
  // Status Transition Tests
  // ==========================================================================

  describe('status transitions', () => {
    describe('submitForReview', () => {
      it('should transition from draft to review', () => {
        const result = createDocPage({
          title: 'Test Page',
          category: 'user-guide',
          content: 'Some content',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const page = result.value;

          page.submitForReview();

          expect(page.status).toBe('review');
        }
      });

      it('should throw error when not in draft status', () => {
        const page = reconstituteDocPage(createValidData({ status: 'published' }));

        expect(() => page.submitForReview()).toThrow(DomainError);
        expect(() => page.submitForReview()).toThrow('Only draft pages can be submitted for review');
      });

      it('should throw error for empty content', () => {
        const result = createDocPage({
          title: 'Test Page',
          category: 'user-guide',
          content: '',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const page = result.value;

          expect(() => page.submitForReview()).toThrow(DomainError);
          expect(() => page.submitForReview()).toThrow('Cannot submit empty page for review');
        }
      });
    });

    describe('publish', () => {
      it('should publish a draft page with content', () => {
        const result = createDocPage({
          title: 'Test Page',
          category: 'user-guide',
          content: 'Some content',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const page = result.value;

          page.publish('admin@test.com');

          expect(page.status).toBe('published');
          expect(page.metadata.publishedBy).toBe('admin@test.com');
          expect(page.metadata.publishedAt).toBeDefined();
        }
      });

      it('should publish a page in review status', () => {
        const page = reconstituteDocPage(createValidData({ status: 'review', content: 'Content' }));

        page.publish();

        expect(page.status).toBe('published');
      });

      it('should throw error when publishing archived page', () => {
        const page = reconstituteDocPage(createValidData({ status: 'archived' }));

        expect(() => page.publish()).toThrow(DomainError);
        expect(() => page.publish()).toThrow('Cannot publish archived page');
      });

      it('should throw error when publishing empty page', () => {
        const result = createDocPage({
          title: 'Test Page',
          category: 'user-guide',
          content: '',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const page = result.value;

          expect(() => page.publish()).toThrow(DomainError);
          expect(() => page.publish()).toThrow('Cannot publish empty page');
        }
      });
    });

    describe('unpublish', () => {
      it('should return published page to draft', () => {
        const page = reconstituteDocPage(createValidData({ status: 'published' }));

        page.unpublish();

        expect(page.status).toBe('draft');
      });

      it('should throw error when unpublishing archived page', () => {
        const page = reconstituteDocPage(createValidData({ status: 'archived' }));

        expect(() => page.unpublish()).toThrow(DomainError);
        expect(() => page.unpublish()).toThrow('Cannot unpublish archived page');
      });
    });

    describe('archive', () => {
      it('should archive a draft page', () => {
        const result = createDocPage({
          title: 'Test Page',
          category: 'user-guide',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          const page = result.value;

          page.archive();

          expect(page.status).toBe('archived');
          expect(page.metadata.archivedAt).toBeDefined();
        }
      });

      it('should archive a published page', () => {
        const page = reconstituteDocPage(createValidData({ status: 'published' }));

        page.archive();

        expect(page.status).toBe('archived');
      });

      it('should be idempotent for already archived page', () => {
        const page = reconstituteDocPage(createValidData({ status: 'archived' }));

        expect(() => page.archive()).not.toThrow();
        expect(page.status).toBe('archived');
      });
    });

    describe('restore', () => {
      it('should restore archived page to draft', () => {
        const page = reconstituteDocPage(createValidData({
          status: 'archived',
          metadata: { archivedAt: new Date().toISOString() },
        }));

        page.restore();

        expect(page.status).toBe('draft');
        expect(page.metadata.archivedAt).toBeUndefined();
      });

      it('should throw error when restoring non-archived page', () => {
        const page = reconstituteDocPage(createValidData({ status: 'draft' }));

        expect(() => page.restore()).toThrow(DomainError);
        expect(() => page.restore()).toThrow('Only archived pages can be restored');
      });
    });
  });

  // ==========================================================================
  // Serialization Tests
  // ==========================================================================

  describe('serialization', () => {
    it('should convert to JSON correctly', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'tutorials',
        content: 'Test content',
        tags: ['tag1', 'tag2'],
        author: 'author@test.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;
        const json = page.toJSON();

        expect(json.id).toBe(page.id);
        expect(json.title).toBe('Test Page');
        expect(json.category).toBe('tutorials');
        expect(json.content).toBe('Test content');
        expect(json.tags).toEqual(['tag1', 'tag2']);
        expect(json.author).toBe('author@test.com');
        expect(json.status).toBe('draft');
      }
    });

    it('should convert to summary correctly', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'tutorials',
        order: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;
        const summary = page.toSummary();

        expect(summary.id).toBe(page.id);
        expect(summary.title).toBe('Test Page');
        expect(summary.slug).toBe('test-page');
        expect(summary.category).toBe('tutorials');
        expect(summary.status).toBe('draft');
        expect(summary.order).toBe(5);
        expect(summary.lastUpdated).toBeDefined();
        // Summary should not include content
        expect((summary as Record<string, unknown>).content).toBeUndefined();
      }
    });

    it('should return defensive copies for tags and metadata', () => {
      const result = createDocPage({
        title: 'Test Page',
        category: 'user-guide',
        tags: ['original'],
        metadata: { key: 'value' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const page = result.value;
        const tags = page.tags;
        const metadata = page.metadata;

        // Modifying returned arrays should not affect the entity
        tags.push('modified');
        (metadata as Record<string, string>).newKey = 'newValue';

        expect(page.tags).not.toContain('modified');
        expect(page.metadata).not.toHaveProperty('newKey');
      }
    });
  });

  // ==========================================================================
  // Equality Tests
  // ==========================================================================

  describe('equality', () => {
    it('should return true for same ID', () => {
      const page1 = reconstituteDocPage(createValidData({ id: 'same-id' }));
      const page2 = reconstituteDocPage(createValidData({ id: 'same-id', title: 'Different Title' }));

      expect(page1.equals(page2)).toBe(true);
    });

    it('should return false for different ID', () => {
      const page1 = reconstituteDocPage(createValidData({ id: 'id-1' }));
      const page2 = reconstituteDocPage(createValidData({ id: 'id-2' }));

      expect(page1.equals(page2)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      const page = reconstituteDocPage(createValidData());

      expect(page.equals(null as unknown as DocPageEntity)).toBe(false);
      expect(page.equals(undefined as unknown as DocPageEntity)).toBe(false);
    });
  });

  // ==========================================================================
  // String Representation Tests
  // ==========================================================================

  describe('toString', () => {
    it('should return meaningful string representation', () => {
      const page = reconstituteDocPage(
        createValidData({
          id: 'page-123',
          title: 'Test Page',
          category: 'user-guide',
          status: 'published',
        })
      );

      const str = page.toString();

      expect(str).toContain('page-123');
      expect(str).toContain('Test Page');
      expect(str).toContain('user-guide');
      expect(str).toContain('published');
    });
  });

  // ==========================================================================
  // Static Methods Tests
  // ==========================================================================

  describe('generateSlug', () => {
    it('should convert to lowercase', () => {
      expect(DocPageEntity.generateSlug('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(DocPageEntity.generateSlug('hello world test')).toBe('hello-world-test');
    });

    it('should remove special characters', () => {
      expect(DocPageEntity.generateSlug("What's New?")).toBe('what-s-new');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(DocPageEntity.generateSlug('  Hello World  ')).toBe('hello-world');
    });

    it('should handle numbers', () => {
      expect(DocPageEntity.generateSlug('Version 2.0 Release')).toBe('version-2-0-release');
    });
  });
});
