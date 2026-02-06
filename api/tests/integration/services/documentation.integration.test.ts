/**
 * Documentation Services Integration Tests
 * @module tests/integration/services/documentation.integration
 *
 * Integration tests for TASK-FINAL-004 component interactions.
 * Tests service-level integration for:
 * - DocumentationService
 * - BetaOnboardingService
 * - LaunchReadinessService
 *
 * These tests verify:
 * - Full CRUD workflows through service layer
 * - State transitions and lifecycle management
 * - Cross-service interactions
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDocumentationService,
  resetDocumentationService,
  type IDocumentationService,
} from '../../../src/services/DocumentationService.js';
import {
  getBetaOnboardingService,
  resetBetaOnboardingService,
  type IBetaOnboardingService,
} from '../../../src/services/BetaOnboardingService.js';
import {
  getLaunchReadinessService,
  resetLaunchReadinessService,
  type ILaunchReadinessService,
} from '../../../src/services/LaunchReadinessService.js';
import { Result } from '../../../src/domain/documentation/index.js';

// ============================================================================
// Documentation Service Integration Tests
// ============================================================================

describe('Documentation Service Integration', () => {
  let service: IDocumentationService;

  beforeEach(() => {
    resetDocumentationService();
    service = getDocumentationService();
  });

  afterEach(() => {
    resetDocumentationService();
  });

  // ==========================================================================
  // Create and Retrieve Flow
  // ==========================================================================

  describe('Create and Retrieve Flow', () => {
    it('should persist page through create and retrieve', async () => {
      // Create a page
      const createResult = await service.createPage({
        title: 'Integration Test Page',
        content: '# Test\n\nThis is integration test content.',
        category: 'user-guide',
      });

      expect(Result.isOk(createResult)).toBe(true);

      if (Result.isOk(createResult)) {
        const createdPage = createResult.value;
        expect(createdPage.id).toBeDefined();
        expect(createdPage.title).toBe('Integration Test Page');
        expect(createdPage.slug).toBe('integration-test-page');
        expect(createdPage.status).toBe('draft');

        // Retrieve by ID
        const retrievedPage = await service.getPage(createdPage.id);
        expect(retrievedPage).not.toBeNull();
        expect(retrievedPage?.id).toBe(createdPage.id);
        expect(retrievedPage?.title).toBe('Integration Test Page');

        // Retrieve by slug
        const bySlug = await service.getPageBySlug(createdPage.slug);
        expect(bySlug).not.toBeNull();
        expect(bySlug?.id).toBe(createdPage.id);
      }
    });

    it('should prevent duplicate slugs', async () => {
      // Create first page
      const firstResult = await service.createPage({
        title: 'Test Page',
        content: '# First',
        category: 'user-guide',
      });

      expect(Result.isOk(firstResult)).toBe(true);

      // Attempt to create page with same title (same slug)
      const secondResult = await service.createPage({
        title: 'Test Page',
        content: '# Second',
        category: 'api-reference',
      });

      expect(Result.isErr(secondResult)).toBe(true);
      if (Result.isErr(secondResult)) {
        expect(secondResult.error.code).toBe('DUPLICATE_SLUG');
      }
    });

    it('should allow custom slug that does not conflict', async () => {
      const result = await service.createPage({
        title: 'My Page',
        content: '# Content',
        category: 'tutorials',
        slug: 'custom-unique-slug',
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.slug).toBe('custom-unique-slug');
      }
    });
  });

  // ==========================================================================
  // Update Flow
  // ==========================================================================

  describe('Update Flow', () => {
    it('should maintain page state through updates', async () => {
      // Create page
      const createResult = await service.createPage({
        title: 'Original Title',
        content: '# Original Content',
        category: 'user-guide',
      });

      expect(Result.isOk(createResult)).toBe(true);

      if (Result.isOk(createResult)) {
        const pageId = createResult.value.id;

        // Update title
        const updateResult = await service.updatePage(pageId, {
          title: 'Updated Title',
        });

        expect(Result.isOk(updateResult)).toBe(true);
        if (Result.isOk(updateResult)) {
          expect(updateResult.value.title).toBe('Updated Title');
          expect(updateResult.value.content).toBe('# Original Content');
        }

        // Update content
        const contentUpdateResult = await service.updatePage(pageId, {
          content: '# Updated Content',
        });

        expect(Result.isOk(contentUpdateResult)).toBe(true);
        if (Result.isOk(contentUpdateResult)) {
          expect(contentUpdateResult.value.title).toBe('Updated Title');
          expect(contentUpdateResult.value.content).toBe('# Updated Content');
        }

        // Verify persistence
        const retrieved = await service.getPage(pageId);
        expect(retrieved?.title).toBe('Updated Title');
        expect(retrieved?.content).toBe('# Updated Content');
      }
    });

    it('should handle tags updates correctly', async () => {
      const createResult = await service.createPage({
        title: 'Tagged Page',
        content: '# Content',
        category: 'tutorials',
        tags: ['original', 'tags'],
      });

      expect(Result.isOk(createResult)).toBe(true);

      if (Result.isOk(createResult)) {
        const pageId = createResult.value.id;

        // Update tags
        const updateResult = await service.updatePage(pageId, {
          tags: ['new', 'different', 'tags'],
        });

        expect(Result.isOk(updateResult)).toBe(true);
        if (Result.isOk(updateResult)) {
          expect(updateResult.value.tags).toEqual(['new', 'different', 'tags']);
        }
      }
    });

    it('should return error for non-existent page update', async () => {
      const result = await service.updatePage('non-existent-id', {
        title: 'New Title',
      });

      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // Status Lifecycle Flow
  // ==========================================================================

  describe('Status Lifecycle Flow', () => {
    it('should complete full lifecycle: draft -> published -> archived -> restored', async () => {
      // Create (starts as draft)
      const createResult = await service.createPage({
        title: 'Lifecycle Page',
        content: '# Content',
        category: 'user-guide',
      });

      expect(Result.isOk(createResult)).toBe(true);

      if (Result.isOk(createResult)) {
        const pageId = createResult.value.id;
        expect(createResult.value.status).toBe('draft');

        // Publish
        const publishResult = await service.publishPage(pageId, 'admin@test.com');
        expect(Result.isOk(publishResult)).toBe(true);
        if (Result.isOk(publishResult)) {
          expect(publishResult.value.status).toBe('published');
          expect(publishResult.value.metadata?.publishedAt).toBeDefined();
          expect(publishResult.value.metadata?.publishedBy).toBe('admin@test.com');
        }

        // Archive
        const archiveResult = await service.archivePage(pageId);
        expect(Result.isOk(archiveResult)).toBe(true);
        if (Result.isOk(archiveResult)) {
          expect(archiveResult.value.status).toBe('archived');
        }

        // Restore
        const restoreResult = await service.restorePage(pageId);
        expect(Result.isOk(restoreResult)).toBe(true);
        if (Result.isOk(restoreResult)) {
          expect(restoreResult.value.status).toBe('draft');
        }
      }
    });

    it('should support unpublish flow', async () => {
      const createResult = await service.createPage({
        title: 'Published Page',
        content: '# Content',
        category: 'api-reference',
      });

      expect(Result.isOk(createResult)).toBe(true);

      if (Result.isOk(createResult)) {
        const pageId = createResult.value.id;

        // Publish
        await service.publishPage(pageId, 'admin@test.com');

        // Unpublish
        const unpublishResult = await service.unpublishPage(pageId);
        expect(Result.isOk(unpublishResult)).toBe(true);
        if (Result.isOk(unpublishResult)) {
          expect(unpublishResult.value.status).toBe('draft');
        }
      }
    });
  });

  // ==========================================================================
  // List and Filter Flow
  // ==========================================================================

  describe('List and Filter Flow', () => {
    beforeEach(async () => {
      // Seed test data
      await service.createPage({ title: 'Guide 1', content: '#1', category: 'user-guide' });
      await service.createPage({ title: 'Guide 2', content: '#2', category: 'user-guide' });
      await service.createPage({ title: 'API Auth', content: '#3', category: 'api-reference' });
      await service.createPage({ title: 'Tutorial 1', content: '#4', category: 'tutorials', tags: ['beginner'] });
    });

    it('should list all pages', async () => {
      const result = await service.listPages();
      expect(result.data.length).toBe(4);
      expect(result.total).toBe(4);
    });

    it('should filter by category', async () => {
      const result = await service.listPages({ category: 'user-guide' });
      expect(result.data.length).toBe(2);
      expect(result.data.every(p => p.category === 'user-guide')).toBe(true);
    });

    it('should filter by status', async () => {
      const result = await service.listPages({ status: 'draft' });
      expect(result.data.length).toBe(4); // All pages start as draft
    });

    it('should search by title or content', async () => {
      const result = await service.listPages({ search: 'API' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('API Auth');
    });

    it('should support pagination', async () => {
      const page1 = await service.listPages(undefined, undefined, { page: 1, pageSize: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);
      expect(page1.totalPages).toBe(2);

      const page2 = await service.listPages(undefined, undefined, { page: 2, pageSize: 2 });
      expect(page2.data.length).toBe(2);
      expect(page2.page).toBe(2);
    });

    it('should support sorting', async () => {
      const result = await service.listPages(
        undefined,
        { field: 'title', direction: 'asc' },
        undefined
      );

      const titles = result.data.map(p => p.title);
      const sortedTitles = [...titles].sort();
      expect(titles).toEqual(sortedTitles);
    });
  });

  // ==========================================================================
  // Delete Flow
  // ==========================================================================

  describe('Delete Flow', () => {
    it('should delete page and remove from indexes', async () => {
      const createResult = await service.createPage({
        title: 'To Delete',
        content: '# Delete me',
        category: 'support',
      });

      expect(Result.isOk(createResult)).toBe(true);

      if (Result.isOk(createResult)) {
        const pageId = createResult.value.id;
        const slug = createResult.value.slug;

        // Delete
        const deleted = await service.deletePage(pageId);
        expect(deleted).toBe(true);

        // Verify gone from both indexes
        expect(await service.getPage(pageId)).toBeNull();
        expect(await service.getPageBySlug(slug)).toBeNull();
      }
    });

    it('should update children when parent deleted', async () => {
      // Create parent
      const parentResult = await service.createPage({
        title: 'Parent Page',
        content: '# Parent',
        category: 'user-guide',
      });

      expect(Result.isOk(parentResult)).toBe(true);

      if (Result.isOk(parentResult)) {
        const parentId = parentResult.value.id;

        // Create child
        const childResult = await service.createPage({
          title: 'Child Page',
          content: '# Child',
          category: 'user-guide',
          parentId: parentId,
        });

        expect(Result.isOk(childResult)).toBe(true);

        if (Result.isOk(childResult)) {
          const childId = childResult.value.id;

          // Delete parent
          await service.deletePage(parentId);

          // Child should no longer have parentId
          const child = await service.getPage(childId);
          expect(child).not.toBeNull();
          expect(child?.parentId).toBeUndefined();
        }
      }
    });
  });

  // ==========================================================================
  // Table of Contents Flow
  // ==========================================================================

  describe('Table of Contents Flow', () => {
    it('should generate TOC for published pages only', async () => {
      // Create and publish some pages
      const page1Result = await service.createPage({
        title: 'Published Guide',
        content: '# Guide',
        category: 'user-guide',
      });

      const page2Result = await service.createPage({
        title: 'Draft Page',
        content: '# Draft',
        category: 'user-guide',
      });

      if (Result.isOk(page1Result)) {
        await service.publishPage(page1Result.value.id, 'admin');
      }

      // Get TOC - should only include published page
      const toc = await service.getTableOfContents();

      expect(toc.categories).toBeDefined();
      expect(toc.lastUpdated).toBeDefined();

      const userGuideCategory = toc.categories.find(c => c.category === 'user-guide');
      if (userGuideCategory) {
        expect(userGuideCategory.items.length).toBe(1);
        expect(userGuideCategory.items[0].title).toBe('Published Guide');
      }
    });
  });

  // ==========================================================================
  // Reorder Flow
  // ==========================================================================

  describe('Reorder Flow', () => {
    it('should reorder pages within category', async () => {
      // Create pages with initial order
      const page1 = await service.createPage({ title: 'First', content: '#1', category: 'tutorials', order: 0 });
      const page2 = await service.createPage({ title: 'Second', content: '#2', category: 'tutorials', order: 1 });
      const page3 = await service.createPage({ title: 'Third', content: '#3', category: 'tutorials', order: 2 });

      if (Result.isOk(page1) && Result.isOk(page2) && Result.isOk(page3)) {
        const pageIds = [page3.value.id, page1.value.id, page2.value.id]; // New order: Third, First, Second

        const reorderResult = await service.reorderPages('tutorials', pageIds);
        expect(Result.isOk(reorderResult)).toBe(true);

        // Verify new order
        const thirdPage = await service.getPage(page3.value.id);
        const firstPage = await service.getPage(page1.value.id);
        const secondPage = await service.getPage(page2.value.id);

        expect(thirdPage?.order).toBe(0);
        expect(firstPage?.order).toBe(1);
        expect(secondPage?.order).toBe(2);
      }
    });
  });
});

// ============================================================================
// Beta Onboarding Service Integration Tests
// ============================================================================

describe('Beta Onboarding Service Integration', () => {
  let service: IBetaOnboardingService;

  beforeEach(() => {
    resetBetaOnboardingService();
    service = getBetaOnboardingService();
  });

  afterEach(() => {
    resetBetaOnboardingService();
  });

  // ==========================================================================
  // Full Onboarding Workflow
  // ==========================================================================

  describe('Full Onboarding Workflow', () => {
    it('should handle complete onboarding lifecycle', async () => {
      // Step 1: Register customer
      const registerResult = await service.registerCustomer({
        companyName: 'Test Corp',
        contactEmail: 'test@corp.com',
        contactName: 'John Doe',
        tier: 'design-partner',
      });

      expect(Result.isOk(registerResult)).toBe(true);

      if (Result.isOk(registerResult)) {
        const customerId = registerResult.value.id;
        expect(registerResult.value.onboardingStatus).toBe('pending');
        expect(registerResult.value.ndaSigned).toBe(false);

        // Step 2: Sign NDA
        const ndaResult = await service.signNDA(customerId, 'legal@company.com');
        expect(Result.isOk(ndaResult)).toBe(true);
        if (Result.isOk(ndaResult)) {
          expect(ndaResult.value.signedAt).toBeDefined();
        }

        // Verify NDA signed
        const customerAfterNDA = await service.getCustomer(customerId);
        expect(customerAfterNDA?.ndaSigned).toBe(true);

        // Step 3: Start onboarding
        const startResult = await service.startOnboarding(customerId);
        expect(Result.isOk(startResult)).toBe(true);
        if (Result.isOk(startResult)) {
          expect(startResult.value.previousStatus).toBe('pending');
          expect(startResult.value.newStatus).toBe('in-progress');
        }

        // Step 4: Record some activity
        await service.recordActivity(customerId);
        await service.recordFeedback(customerId);

        // Step 5: Complete onboarding
        const completeResult = await service.completeOnboarding(customerId);
        expect(Result.isOk(completeResult)).toBe(true);
        if (Result.isOk(completeResult)) {
          expect(completeResult.value.previousStatus).toBe('in-progress');
          expect(completeResult.value.newStatus).toBe('completed');
        }

        // Final verification
        const finalCustomer = await service.getCustomer(customerId);
        expect(finalCustomer?.onboardingStatus).toBe('completed');
        expect(finalCustomer?.feedbackCount).toBe(1);
      }
    });

    it('should handle churn and reactivation', async () => {
      // Register and complete onboarding
      const registerResult = await service.registerCustomer({
        companyName: 'Churn Test Corp',
        contactEmail: 'churn@corp.com',
      });

      if (Result.isOk(registerResult)) {
        const customerId = registerResult.value.id;
        await service.signNDA(customerId);  // Must sign NDA before onboarding
        await service.startOnboarding(customerId);
        await service.completeOnboarding(customerId);

        // Mark as churned
        const churnResult = await service.markAsChurned(customerId, 'Budget constraints');
        expect(Result.isOk(churnResult)).toBe(true);
        if (Result.isOk(churnResult)) {
          expect(churnResult.value.onboardingStatus).toBe('churned');
        }

        // Reactivate
        const reactivateResult = await service.reactivateCustomer(customerId);
        expect(Result.isOk(reactivateResult)).toBe(true);
        if (Result.isOk(reactivateResult)) {
          expect(reactivateResult.value.previousStatus).toBe('churned');
          expect(reactivateResult.value.newStatus).toBe('in-progress');
        }
      }
    });
  });

  // ==========================================================================
  // Duplicate Prevention
  // ==========================================================================

  describe('Duplicate Prevention', () => {
    it('should prevent duplicate email registration', async () => {
      await service.registerCustomer({
        companyName: 'First Corp',
        contactEmail: 'duplicate@test.com',
      });

      const secondResult = await service.registerCustomer({
        companyName: 'Second Corp',
        contactEmail: 'duplicate@test.com',
      });

      expect(Result.isErr(secondResult)).toBe(true);
      if (Result.isErr(secondResult)) {
        expect(secondResult.error.code).toBe('DUPLICATE_EMAIL');
      }
    });

    it('should normalize email case for duplicate check', async () => {
      await service.registerCustomer({
        companyName: 'First Corp',
        contactEmail: 'Test@Example.COM',
      });

      const secondResult = await service.registerCustomer({
        companyName: 'Second Corp',
        contactEmail: 'test@example.com',
      });

      expect(Result.isErr(secondResult)).toBe(true);
    });
  });

  // ==========================================================================
  // List and Filter
  // ==========================================================================

  describe('List and Filter', () => {
    beforeEach(async () => {
      // Seed customers
      const c1 = await service.registerCustomer({ companyName: 'Alpha Corp', contactEmail: 'a@test.com', tier: 'design-partner' });
      const c2 = await service.registerCustomer({ companyName: 'Beta Inc', contactEmail: 'b@test.com', tier: 'early-adopter' });
      const c3 = await service.registerCustomer({ companyName: 'Gamma LLC', contactEmail: 'c@test.com', tier: 'beta-tester' });

      // Progress some customers
      if (Result.isOk(c1)) {
        await service.signNDA(c1.value.id);
        await service.startOnboarding(c1.value.id);
        await service.completeOnboarding(c1.value.id);
      }
      if (Result.isOk(c2)) {
        await service.signNDA(c2.value.id);
        await service.startOnboarding(c2.value.id);
      }
    });

    it('should filter by status', async () => {
      const completed = await service.listCustomers({ status: 'completed' });
      expect(completed.data.length).toBe(1);
      expect(completed.data[0].companyName).toBe('Alpha Corp');

      const inProgress = await service.listCustomers({ status: 'in-progress' });
      expect(inProgress.data.length).toBe(1);

      const pending = await service.listCustomers({ status: 'pending' });
      expect(pending.data.length).toBe(1);
    });

    it('should filter by tier', async () => {
      const designPartners = await service.listCustomers({ tier: 'design-partner' });
      expect(designPartners.data.length).toBe(1);
    });

    it('should filter by NDA signed', async () => {
      const signed = await service.listCustomers({ ndaSigned: true });
      expect(signed.data.length).toBe(2);

      const unsigned = await service.listCustomers({ ndaSigned: false });
      expect(unsigned.data.length).toBe(1);
    });

    it('should search by company name or email', async () => {
      const result = await service.listCustomers({ search: 'Alpha' });
      expect(result.data.length).toBe(1);

      const emailSearch = await service.listCustomers({ search: 'b@test' });
      expect(emailSearch.data.length).toBe(1);
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe('Statistics', () => {
    it('should calculate accurate statistics', async () => {
      // Seed data
      const c1 = await service.registerCustomer({ companyName: 'A', contactEmail: 'a@t.com', tier: 'design-partner' });
      const c2 = await service.registerCustomer({ companyName: 'B', contactEmail: 'b@t.com', tier: 'early-adopter' });
      const c3 = await service.registerCustomer({ companyName: 'C', contactEmail: 'c@t.com', tier: 'beta-tester' });

      if (Result.isOk(c1)) {
        await service.signNDA(c1.value.id);
        await service.startOnboarding(c1.value.id);
        await service.completeOnboarding(c1.value.id);
        await service.recordFeedback(c1.value.id);
        await service.recordFeedback(c1.value.id);
      }
      if (Result.isOk(c2)) {
        await service.signNDA(c2.value.id);
        await service.startOnboarding(c2.value.id);
        await service.recordFeedback(c2.value.id);
      }

      const stats = await service.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byStatus.completed).toBe(1);
      expect(stats.byStatus.inProgress).toBe(1);
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.byTier.designPartner).toBe(1);
      expect(stats.byTier.earlyAdopter).toBe(1);
      expect(stats.byTier.betaTester).toBe(1);
      expect(stats.ndaSignedCount).toBe(2);
      expect(stats.averageFeedbackCount).toBe(1); // (2 + 1 + 0) / 3 = 1
    });
  });
});

// ============================================================================
// Launch Readiness Service Integration Tests
// ============================================================================

describe('Launch Readiness Service Integration', () => {
  let service: ILaunchReadinessService;

  beforeEach(async () => {
    resetLaunchReadinessService();
    service = getLaunchReadinessService();
  });

  afterEach(() => {
    resetLaunchReadinessService();
  });

  // ==========================================================================
  // Checklist Item Lifecycle
  // ==========================================================================

  describe('Checklist Item Lifecycle', () => {
    it('should create and complete checklist items', async () => {
      // Create item
      const createResult = await service.createItem({
        category: 'security',
        description: 'SSL certificate installed',
        priority: 'critical',
      });

      expect(Result.isOk(createResult)).toBe(true);

      if (Result.isOk(createResult)) {
        const itemId = createResult.value.id;
        expect(createResult.value.completed).toBe(false);
        expect(createResult.value.category).toBe('security');
        expect(createResult.value.priority).toBe('critical');

        // Complete item
        const completeResult = await service.completeItem(itemId, {
          completedBy: 'devops@team.com',
          evidence: 'Certificate verified via SSL Labs',
        });

        expect(Result.isOk(completeResult)).toBe(true);
        if (Result.isOk(completeResult)) {
          expect(completeResult.value.completed).toBe(true);
          expect(completeResult.value.completedBy).toBe('devops@team.com');
          expect(completeResult.value.evidence).toBe('Certificate verified via SSL Labs');
          expect(completeResult.value.completedAt).toBeDefined();
        }

        // Verify persistence
        const retrieved = await service.getItem(itemId);
        expect(retrieved?.completed).toBe(true);
      }
    });

    it('should support uncomplete flow', async () => {
      const createResult = await service.createItem({
        category: 'testing',
        description: 'Unit tests passing',
        priority: 'high',
      });

      if (Result.isOk(createResult)) {
        const itemId = createResult.value.id;

        // Complete
        await service.completeItem(itemId);

        // Uncomplete
        const uncompleteResult = await service.uncompleteItem(itemId);
        expect(Result.isOk(uncompleteResult)).toBe(true);
        if (Result.isOk(uncompleteResult)) {
          expect(uncompleteResult.value.completed).toBe(false);
          expect(uncompleteResult.value.completedAt).toBeUndefined();
        }
      }
    });
  });

  // ==========================================================================
  // Blocker Management
  // ==========================================================================

  describe('Blocker Management', () => {
    it('should manage blockers between items', async () => {
      // Create two items
      const item1Result = await service.createItem({
        category: 'infrastructure',
        description: 'Database setup',
        priority: 'critical',
      });

      const item2Result = await service.createItem({
        category: 'infrastructure',
        description: 'Backend deployment',
        priority: 'critical',
      });

      if (Result.isOk(item1Result) && Result.isOk(item2Result)) {
        const dbItemId = item1Result.value.id;
        const backendItemId = item2Result.value.id;

        // Backend is blocked by database
        const addBlockerResult = await service.addBlocker(backendItemId, dbItemId);
        expect(Result.isOk(addBlockerResult)).toBe(true);
        if (Result.isOk(addBlockerResult)) {
          expect(addBlockerResult.value.blockedBy).toContain(dbItemId);
        }

        // Verify blocked items list
        const blockedItems = await service.getBlockedItems();
        expect(blockedItems.length).toBe(1);
        expect(blockedItems[0].id).toBe(backendItemId);

        // Complete database item
        await service.completeItem(dbItemId);

        // Remove blocker
        const removeBlockerResult = await service.removeBlocker(backendItemId, dbItemId);
        expect(Result.isOk(removeBlockerResult)).toBe(true);

        // No longer blocked
        const blockedAfter = await service.getBlockedItems();
        expect(blockedAfter.length).toBe(0);
      }
    });

    it('should prevent self-blocking', async () => {
      const itemResult = await service.createItem({
        category: 'testing',
        description: 'Test item',
        priority: 'medium',
      });

      if (Result.isOk(itemResult)) {
        const itemId = itemResult.value.id;

        const result = await service.addBlocker(itemId, itemId);
        expect(Result.isErr(result)).toBe(true);
        if (Result.isErr(result)) {
          expect(result.error.code).toBe('SELF_BLOCK');
        }
      }
    });
  });

  // ==========================================================================
  // Readiness Assessment
  // ==========================================================================

  describe('Readiness Assessment', () => {
    beforeEach(async () => {
      // Create standard checklist items
      await service.createItem({ category: 'security', description: 'SSL', priority: 'critical' });
      await service.createItem({ category: 'security', description: 'Auth', priority: 'critical' });
      await service.createItem({ category: 'testing', description: 'Unit tests', priority: 'high' });
      await service.createItem({ category: 'documentation', description: 'API docs', priority: 'medium' });
    });

    it('should report not ready when critical items incomplete', async () => {
      const assessment = await service.assessLaunchReadiness();

      expect(assessment.readyForLaunch).toBe(false);
      expect(assessment.criticalItemsRemaining).toBe(2);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations.some(r => r.includes('Not yet ready'))).toBe(true);
    });

    it('should report ready when all critical items complete', async () => {
      // Get all items
      const items = await service.listItems();
      const criticalItems = items.filter(i => i.priority === 'critical');

      // Complete all critical items
      for (const item of criticalItems) {
        await service.completeItem(item.id);
      }

      const assessment = await service.assessLaunchReadiness();

      expect(assessment.readyForLaunch).toBe(true);
      expect(assessment.criticalItemsRemaining).toBe(0);
      expect(assessment.recommendations.some(r => r.includes('ready for launch'))).toBe(true);
    });

    it('should track progress by category', async () => {
      // Complete one security item
      const items = await service.listItems({ category: 'security' });
      if (items.length > 0) {
        await service.completeItem(items[0].id);
      }

      const progress = await service.getProgressByCategory();
      const securityProgress = progress.find(p => p.category === 'security');

      expect(securityProgress).toBeDefined();
      expect(securityProgress?.completed).toBe(1);
      expect(securityProgress?.total).toBe(2);
      expect(securityProgress?.percentage).toBe(50);
    });
  });

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  describe('Bulk Operations', () => {
    it('should bulk complete items', async () => {
      const item1 = await service.createItem({ category: 'compliance', description: 'Privacy policy', priority: 'critical' });
      const item2 = await service.createItem({ category: 'compliance', description: 'Terms of service', priority: 'critical' });
      const item3 = await service.createItem({ category: 'compliance', description: 'Cookie policy', priority: 'medium' });

      if (Result.isOk(item1) && Result.isOk(item2) && Result.isOk(item3)) {
        const itemIds = [item1.value.id, item2.value.id, item3.value.id];

        const bulkResult = await service.bulkCompleteItems(itemIds, {
          completedBy: 'legal@company.com',
        });

        expect(bulkResult.successful.length).toBe(3);
        expect(bulkResult.failed.length).toBe(0);

        // Verify all completed
        const items = await service.listItems({ category: 'compliance' });
        expect(items.every(i => i.completed)).toBe(true);
      }
    });

    it('should bulk assign items', async () => {
      const item1 = await service.createItem({ category: 'marketing', description: 'Landing page', priority: 'high' });
      const item2 = await service.createItem({ category: 'marketing', description: 'Press release', priority: 'medium' });

      if (Result.isOk(item1) && Result.isOk(item2)) {
        const itemIds = [item1.value.id, item2.value.id];

        const bulkResult = await service.bulkAssignItems(itemIds, 'marketing@team.com');

        expect(bulkResult.successful.length).toBe(2);

        // Verify assignment
        const items = await service.listItems({ category: 'marketing' });
        expect(items.every(i => i.assignee === 'marketing@team.com')).toBe(true);
      }
    });

    it('should handle partial failures in bulk operations', async () => {
      const item1 = await service.createItem({ category: 'support', description: 'Help desk', priority: 'high' });

      if (Result.isOk(item1)) {
        const itemIds = [item1.value.id, 'non-existent-id'];

        const bulkResult = await service.bulkCompleteItems(itemIds);

        expect(bulkResult.successful.length).toBe(1);
        expect(bulkResult.failed.length).toBe(1);
        expect(bulkResult.failed[0].id).toBe('non-existent-id');
        expect(bulkResult.failed[0].error.code).toBe('ITEM_NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // Target Launch Date
  // ==========================================================================

  describe('Target Launch Date', () => {
    it('should set and clear target launch date', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const setResult = await service.setTargetLaunchDate(futureDate);
      expect(Result.isOk(setResult)).toBe(true);
      if (Result.isOk(setResult)) {
        expect(setResult.value.targetLaunchDate).toBeDefined();
      }

      const checklist = await service.getChecklist();
      expect(checklist.targetLaunchDate).toBeDefined();

      const clearResult = await service.clearTargetLaunchDate();
      expect(Result.isOk(clearResult)).toBe(true);

      const checklistAfter = await service.getChecklist();
      expect(checklistAfter.targetLaunchDate).toBeUndefined();
    });
  });
});

// ============================================================================
// Cross-Service Integration Tests
// ============================================================================

describe('Cross-Service Integration', () => {
  let docService: IDocumentationService;
  let betaService: IBetaOnboardingService;
  let launchService: ILaunchReadinessService;

  beforeEach(() => {
    resetDocumentationService();
    resetBetaOnboardingService();
    resetLaunchReadinessService();

    docService = getDocumentationService();
    betaService = getBetaOnboardingService();
    launchService = getLaunchReadinessService();
  });

  afterEach(() => {
    resetDocumentationService();
    resetBetaOnboardingService();
    resetLaunchReadinessService();
  });

  // ==========================================================================
  // Documentation + Launch Integration
  // ==========================================================================

  describe('Documentation + Launch Integration', () => {
    it('should verify documentation completion affects launch readiness', async () => {
      // Create documentation checklist item
      const docItemResult = await launchService.createItem({
        category: 'documentation',
        description: 'API documentation complete',
        priority: 'high',
      });

      expect(Result.isOk(docItemResult)).toBe(true);

      // Create the actual documentation
      const apiDocResult = await docService.createPage({
        title: 'API Reference',
        content: '# API Reference\n\nComplete API documentation.',
        category: 'api-reference',
      });

      expect(Result.isOk(apiDocResult)).toBe(true);

      if (Result.isOk(apiDocResult) && Result.isOk(docItemResult)) {
        // Publish the documentation
        await docService.publishPage(apiDocResult.value.id, 'docs-team@company.com');

        // Mark checklist item as complete with evidence
        await launchService.completeItem(docItemResult.value.id, {
          completedBy: 'docs-team@company.com',
          evidence: `Documentation published: ${apiDocResult.value.slug}`,
        });

        // Verify item is complete
        const item = await launchService.getItem(docItemResult.value.id);
        expect(item?.completed).toBe(true);
        expect(item?.evidence).toContain(apiDocResult.value.slug);
      }
    });
  });

  // ==========================================================================
  // Beta + Launch Integration
  // ==========================================================================

  describe('Beta + Launch Integration', () => {
    it('should verify beta customer metrics inform launch readiness', async () => {
      // Create beta-related checklist items
      await launchService.createItem({
        category: 'testing',
        description: 'Beta program completed with 5+ customers',
        priority: 'high',
      });

      // Register beta customers
      for (let i = 0; i < 6; i++) {
        const result = await betaService.registerCustomer({
          companyName: `Beta Customer ${i + 1}`,
          contactEmail: `customer${i + 1}@beta.com`,
          tier: 'beta-tester',
        });

        if (Result.isOk(result)) {
          await betaService.signNDA(result.value.id);
          await betaService.startOnboarding(result.value.id);
          await betaService.completeOnboarding(result.value.id);
        }
      }

      // Get beta statistics
      const betaStats = await betaService.getStatistics();
      expect(betaStats.total).toBe(6);
      expect(betaStats.byStatus.completed).toBe(6);

      // Use beta stats to inform launch readiness
      const items = await launchService.listItems({ category: 'testing' });
      const betaItem = items.find(i => i.description.includes('Beta program'));

      if (betaItem && betaStats.byStatus.completed >= 5) {
        await launchService.completeItem(betaItem.id, {
          completedBy: 'product@company.com',
          evidence: `${betaStats.byStatus.completed} beta customers completed onboarding`,
        });

        const completedItem = await launchService.getItem(betaItem.id);
        expect(completedItem?.completed).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Full Launch Workflow
  // ==========================================================================

  describe('Full Launch Workflow', () => {
    it('should simulate complete launch preparation workflow', async () => {
      // 1. Setup documentation
      const userGuideResult = await docService.createPage({
        title: 'Getting Started',
        content: '# Getting Started\n\nWelcome to our platform.',
        category: 'getting-started',
      });

      const apiDocsResult = await docService.createPage({
        title: 'API Reference',
        content: '# API\n\nComplete API documentation.',
        category: 'api-reference',
      });

      // Publish docs
      if (Result.isOk(userGuideResult)) {
        await docService.publishPage(userGuideResult.value.id, 'docs-team');
      }
      if (Result.isOk(apiDocsResult)) {
        await docService.publishPage(apiDocsResult.value.id, 'docs-team');
      }

      // 2. Setup beta customers
      const betaCustomers = [];
      for (let i = 0; i < 3; i++) {
        const result = await betaService.registerCustomer({
          companyName: `Launch Partner ${i + 1}`,
          contactEmail: `partner${i + 1}@launch.com`,
          tier: 'design-partner',
        });
        if (Result.isOk(result)) {
          betaCustomers.push(result.value);
          await betaService.signNDA(result.value.id);
          await betaService.startOnboarding(result.value.id);
          await betaService.completeOnboarding(result.value.id);
          // Record feedback
          await betaService.recordFeedback(result.value.id);
          await betaService.recordFeedback(result.value.id);
        }
      }

      // 3. Setup launch checklist
      const docCheckItem = await launchService.createItem({
        category: 'documentation',
        description: 'User documentation published',
        priority: 'critical',
      });

      const betaCheckItem = await launchService.createItem({
        category: 'testing',
        description: 'Beta program feedback collected',
        priority: 'critical',
      });

      const infraCheckItem = await launchService.createItem({
        category: 'infrastructure',
        description: 'Production environment ready',
        priority: 'critical',
      });

      // 4. Complete checklist items based on actual state
      if (Result.isOk(docCheckItem)) {
        const toc = await docService.getTableOfContents();
        const totalPublished = toc.categories.reduce((sum, cat) => sum + cat.items.length, 0);

        if (totalPublished >= 2) {
          await launchService.completeItem(docCheckItem.value.id, {
            completedBy: 'docs-team',
            evidence: `${totalPublished} documentation pages published`,
          });
        }
      }

      if (Result.isOk(betaCheckItem)) {
        const betaStats = await betaService.getStatistics();

        if (betaStats.averageFeedbackCount >= 1) {
          await launchService.completeItem(betaCheckItem.value.id, {
            completedBy: 'product-team',
            evidence: `${betaStats.total} customers, avg ${betaStats.averageFeedbackCount} feedback per customer`,
          });
        }
      }

      if (Result.isOk(infraCheckItem)) {
        // Simulate infrastructure being ready
        await launchService.completeItem(infraCheckItem.value.id, {
          completedBy: 'devops-team',
          evidence: 'Production cluster deployed and health checks passing',
        });
      }

      // 5. Assess launch readiness
      const assessment = await launchService.assessLaunchReadiness();

      // All critical items should be complete
      expect(assessment.readyForLaunch).toBe(true);
      expect(assessment.criticalItemsRemaining).toBe(0);
      expect(assessment.overallProgress).toBe(100);

      // Summary should include ready message
      expect(assessment.recommendations[0]).toContain('ready for launch');

      // Verify statistics
      const betaStats = await betaService.getStatistics();
      expect(betaStats.byStatus.completed).toBe(3);
      expect(betaStats.ndaSignedCount).toBe(3);

      const launchSummary = await launchService.getReadinessSummary();
      expect(launchSummary.readyForLaunch).toBe(true);
    });
  });
});
