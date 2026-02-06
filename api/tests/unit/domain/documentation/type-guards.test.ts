/**
 * Type Guards Unit Tests
 * @module tests/unit/domain/documentation/type-guards
 *
 * Tests for all type guard functions in the documentation types module.
 * Ensures runtime type checking works correctly for:
 * - DocPage
 * - BetaCustomer
 * - ChecklistItem
 * - LaunchChecklist
 * - Enum value guards
 *
 * TASK-FINAL-004: Documentation system testing
 */

import { describe, it, expect } from 'vitest';
import {
  isDocPage,
  isDocPageCategory,
  isBetaCustomer,
  isOnboardingStatus,
  isChecklistItem,
  isChecklistCategory,
  isLaunchChecklist,
  DocPageCategory,
  DocPageStatus,
  OnboardingStatus,
  BetaCustomerTier,
  ChecklistCategory,
  ChecklistPriority,
} from '../../../../src/types/documentation.js';

// ============================================================================
// isDocPage Tests
// ============================================================================

describe('isDocPage', () => {
  it('should return true for valid DocPage', () => {
    const validPage = {
      id: 'page-123',
      title: 'Test Page',
      slug: 'test-page',
      content: '# Test',
      category: 'user-guide',
      lastUpdated: new Date().toISOString(),
    };

    expect(isDocPage(validPage)).toBe(true);
  });

  it('should return true for DocPage with optional fields', () => {
    const fullPage = {
      id: 'page-123',
      title: 'Test Page',
      slug: 'test-page',
      content: '# Test',
      category: 'api-reference',
      status: 'published',
      order: 5,
      parentId: 'parent-123',
      tags: ['tag1', 'tag2'],
      author: 'author@test.com',
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      metadata: { key: 'value' },
    };

    expect(isDocPage(fullPage)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isDocPage(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isDocPage(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isDocPage('string')).toBe(false);
    expect(isDocPage(123)).toBe(false);
    expect(isDocPage(true)).toBe(false);
    expect(isDocPage([])).toBe(false);
  });

  it('should return false when missing id', () => {
    const page = {
      title: 'Test Page',
      slug: 'test-page',
      content: '# Test',
      category: 'user-guide',
      lastUpdated: new Date().toISOString(),
    };

    expect(isDocPage(page)).toBe(false);
  });

  it('should return false when missing title', () => {
    const page = {
      id: 'page-123',
      slug: 'test-page',
      content: '# Test',
      category: 'user-guide',
      lastUpdated: new Date().toISOString(),
    };

    expect(isDocPage(page)).toBe(false);
  });

  it('should return false when missing slug', () => {
    const page = {
      id: 'page-123',
      title: 'Test Page',
      content: '# Test',
      category: 'user-guide',
      lastUpdated: new Date().toISOString(),
    };

    expect(isDocPage(page)).toBe(false);
  });

  it('should return false when missing content', () => {
    const page = {
      id: 'page-123',
      title: 'Test Page',
      slug: 'test-page',
      category: 'user-guide',
      lastUpdated: new Date().toISOString(),
    };

    expect(isDocPage(page)).toBe(false);
  });

  it('should return false when missing category', () => {
    const page = {
      id: 'page-123',
      title: 'Test Page',
      slug: 'test-page',
      content: '# Test',
      lastUpdated: new Date().toISOString(),
    };

    expect(isDocPage(page)).toBe(false);
  });

  it('should return false when missing lastUpdated', () => {
    const page = {
      id: 'page-123',
      title: 'Test Page',
      slug: 'test-page',
      content: '# Test',
      category: 'user-guide',
    };

    expect(isDocPage(page)).toBe(false);
  });
});

// ============================================================================
// isDocPageCategory Tests
// ============================================================================

describe('isDocPageCategory', () => {
  it('should return true for all valid categories', () => {
    const validCategories = [
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
      expect(isDocPageCategory(category)).toBe(true);
    }
  });

  it('should return false for invalid category strings', () => {
    expect(isDocPageCategory('invalid')).toBe(false);
    expect(isDocPageCategory('USER-GUIDE')).toBe(false);
    expect(isDocPageCategory('user_guide')).toBe(false);
    expect(isDocPageCategory('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isDocPageCategory(null)).toBe(false);
    expect(isDocPageCategory(undefined)).toBe(false);
    expect(isDocPageCategory(123)).toBe(false);
    expect(isDocPageCategory({})).toBe(false);
    expect(isDocPageCategory([])).toBe(false);
  });
});

// ============================================================================
// isBetaCustomer Tests
// ============================================================================

describe('isBetaCustomer', () => {
  it('should return true for valid BetaCustomer', () => {
    const validCustomer = {
      id: 'customer-123',
      companyName: 'Acme Corp',
      contactEmail: 'contact@acme.com',
      ndaSigned: true,
      onboardingStatus: 'in-progress',
      createdAt: new Date().toISOString(),
    };

    expect(isBetaCustomer(validCustomer)).toBe(true);
  });

  it('should return true for BetaCustomer with optional fields', () => {
    const fullCustomer = {
      id: 'customer-123',
      companyName: 'Acme Corp',
      contactEmail: 'contact@acme.com',
      contactName: 'John Doe',
      ndaSigned: true,
      ndaSignedAt: new Date().toISOString(),
      onboardingStatus: 'completed',
      tier: 'design-partner',
      notes: 'Important customer',
      feedbackCount: 10,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isBetaCustomer(fullCustomer)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isBetaCustomer(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isBetaCustomer(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isBetaCustomer('string')).toBe(false);
    expect(isBetaCustomer(123)).toBe(false);
    expect(isBetaCustomer(true)).toBe(false);
  });

  it('should return false when missing required fields', () => {
    const missingId = {
      companyName: 'Acme Corp',
      contactEmail: 'contact@acme.com',
      ndaSigned: true,
      onboardingStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    const missingCompanyName = {
      id: 'customer-123',
      contactEmail: 'contact@acme.com',
      ndaSigned: true,
      onboardingStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    const missingContactEmail = {
      id: 'customer-123',
      companyName: 'Acme Corp',
      ndaSigned: true,
      onboardingStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    const missingNdaSigned = {
      id: 'customer-123',
      companyName: 'Acme Corp',
      contactEmail: 'contact@acme.com',
      onboardingStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    const missingOnboardingStatus = {
      id: 'customer-123',
      companyName: 'Acme Corp',
      contactEmail: 'contact@acme.com',
      ndaSigned: true,
      createdAt: new Date().toISOString(),
    };

    const missingCreatedAt = {
      id: 'customer-123',
      companyName: 'Acme Corp',
      contactEmail: 'contact@acme.com',
      ndaSigned: true,
      onboardingStatus: 'pending',
    };

    expect(isBetaCustomer(missingId)).toBe(false);
    expect(isBetaCustomer(missingCompanyName)).toBe(false);
    expect(isBetaCustomer(missingContactEmail)).toBe(false);
    expect(isBetaCustomer(missingNdaSigned)).toBe(false);
    expect(isBetaCustomer(missingOnboardingStatus)).toBe(false);
    expect(isBetaCustomer(missingCreatedAt)).toBe(false);
  });
});

// ============================================================================
// isOnboardingStatus Tests
// ============================================================================

describe('isOnboardingStatus', () => {
  it('should return true for all valid statuses', () => {
    const validStatuses = ['pending', 'in-progress', 'completed', 'churned'];

    for (const status of validStatuses) {
      expect(isOnboardingStatus(status)).toBe(true);
    }
  });

  it('should return false for invalid status strings', () => {
    expect(isOnboardingStatus('invalid')).toBe(false);
    expect(isOnboardingStatus('PENDING')).toBe(false);
    expect(isOnboardingStatus('in_progress')).toBe(false);
    expect(isOnboardingStatus('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isOnboardingStatus(null)).toBe(false);
    expect(isOnboardingStatus(undefined)).toBe(false);
    expect(isOnboardingStatus(123)).toBe(false);
    expect(isOnboardingStatus({})).toBe(false);
  });
});

// ============================================================================
// isChecklistItem Tests
// ============================================================================

describe('isChecklistItem', () => {
  it('should return true for valid ChecklistItem', () => {
    const validItem = {
      id: 'item-123',
      category: 'security',
      description: 'Implement 2FA',
      completed: false,
    };

    expect(isChecklistItem(validItem)).toBe(true);
  });

  it('should return true for ChecklistItem with optional fields', () => {
    const fullItem = {
      id: 'item-123',
      category: 'security',
      description: 'Implement 2FA',
      priority: 'critical',
      completed: true,
      completedBy: 'user@test.com',
      completedAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      assignee: 'assignee@test.com',
      notes: 'Important item',
      blockedBy: ['blocker-1'],
      evidence: 'PR #123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isChecklistItem(fullItem)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isChecklistItem(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isChecklistItem(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isChecklistItem('string')).toBe(false);
    expect(isChecklistItem(123)).toBe(false);
  });

  it('should return false when missing required fields', () => {
    const missingId = {
      category: 'security',
      description: 'Test',
      completed: false,
    };

    const missingCategory = {
      id: 'item-123',
      description: 'Test',
      completed: false,
    };

    const missingDescription = {
      id: 'item-123',
      category: 'security',
      completed: false,
    };

    const missingCompleted = {
      id: 'item-123',
      category: 'security',
      description: 'Test',
    };

    expect(isChecklistItem(missingId)).toBe(false);
    expect(isChecklistItem(missingCategory)).toBe(false);
    expect(isChecklistItem(missingDescription)).toBe(false);
    expect(isChecklistItem(missingCompleted)).toBe(false);
  });
});

// ============================================================================
// isChecklistCategory Tests
// ============================================================================

describe('isChecklistCategory', () => {
  it('should return true for all valid categories', () => {
    const validCategories = [
      'infrastructure',
      'security',
      'documentation',
      'testing',
      'compliance',
      'marketing',
      'support',
      'legal',
    ];

    for (const category of validCategories) {
      expect(isChecklistCategory(category)).toBe(true);
    }
  });

  it('should return false for invalid category strings', () => {
    expect(isChecklistCategory('invalid')).toBe(false);
    expect(isChecklistCategory('INFRASTRUCTURE')).toBe(false);
    expect(isChecklistCategory('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isChecklistCategory(null)).toBe(false);
    expect(isChecklistCategory(undefined)).toBe(false);
    expect(isChecklistCategory(123)).toBe(false);
  });
});

// ============================================================================
// isLaunchChecklist Tests
// ============================================================================

describe('isLaunchChecklist', () => {
  it('should return true for valid LaunchChecklist', () => {
    const validChecklist = {
      items: [],
      overallProgress: 0,
      readyForLaunch: false,
    };

    expect(isLaunchChecklist(validChecklist)).toBe(true);
  });

  it('should return true for LaunchChecklist with items', () => {
    const checklistWithItems = {
      id: 'checklist-123',
      name: 'Launch Checklist',
      items: [
        {
          id: 'item-1',
          category: 'security',
          description: 'Test',
          completed: false,
        },
      ],
      overallProgress: 0,
      readyForLaunch: false,
      targetLaunchDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    expect(isLaunchChecklist(checklistWithItems)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isLaunchChecklist(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isLaunchChecklist(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isLaunchChecklist('string')).toBe(false);
    expect(isLaunchChecklist(123)).toBe(false);
  });

  it('should return false when items is not an array', () => {
    const invalidItems = {
      items: 'not-an-array',
      overallProgress: 0,
      readyForLaunch: false,
    };

    expect(isLaunchChecklist(invalidItems)).toBe(false);
  });

  it('should return false when missing overallProgress', () => {
    const missingProgress = {
      items: [],
      readyForLaunch: false,
    };

    expect(isLaunchChecklist(missingProgress)).toBe(false);
  });

  it('should return false when missing readyForLaunch', () => {
    const missingReady = {
      items: [],
      overallProgress: 0,
    };

    expect(isLaunchChecklist(missingReady)).toBe(false);
  });
});

// ============================================================================
// Enum Constants Tests
// ============================================================================

describe('Enum Constants', () => {
  describe('DocPageCategory', () => {
    it('should have all expected values', () => {
      expect(DocPageCategory.USER_GUIDE).toBe('user-guide');
      expect(DocPageCategory.API_REFERENCE).toBe('api-reference');
      expect(DocPageCategory.INTEGRATION).toBe('integration');
      expect(DocPageCategory.SUPPORT).toBe('support');
      expect(DocPageCategory.GETTING_STARTED).toBe('getting-started');
      expect(DocPageCategory.TUTORIALS).toBe('tutorials');
      expect(DocPageCategory.TROUBLESHOOTING).toBe('troubleshooting');
      expect(DocPageCategory.RELEASE_NOTES).toBe('release-notes');
    });
  });

  describe('DocPageStatus', () => {
    it('should have all expected values', () => {
      expect(DocPageStatus.DRAFT).toBe('draft');
      expect(DocPageStatus.REVIEW).toBe('review');
      expect(DocPageStatus.PUBLISHED).toBe('published');
      expect(DocPageStatus.ARCHIVED).toBe('archived');
    });
  });

  describe('OnboardingStatus', () => {
    it('should have all expected values', () => {
      expect(OnboardingStatus.PENDING).toBe('pending');
      expect(OnboardingStatus.IN_PROGRESS).toBe('in-progress');
      expect(OnboardingStatus.COMPLETED).toBe('completed');
      expect(OnboardingStatus.CHURNED).toBe('churned');
    });
  });

  describe('BetaCustomerTier', () => {
    it('should have all expected values', () => {
      expect(BetaCustomerTier.DESIGN_PARTNER).toBe('design-partner');
      expect(BetaCustomerTier.EARLY_ADOPTER).toBe('early-adopter');
      expect(BetaCustomerTier.BETA_TESTER).toBe('beta-tester');
    });
  });

  describe('ChecklistCategory', () => {
    it('should have all expected values', () => {
      expect(ChecklistCategory.INFRASTRUCTURE).toBe('infrastructure');
      expect(ChecklistCategory.SECURITY).toBe('security');
      expect(ChecklistCategory.DOCUMENTATION).toBe('documentation');
      expect(ChecklistCategory.TESTING).toBe('testing');
      expect(ChecklistCategory.COMPLIANCE).toBe('compliance');
      expect(ChecklistCategory.MARKETING).toBe('marketing');
      expect(ChecklistCategory.SUPPORT).toBe('support');
      expect(ChecklistCategory.LEGAL).toBe('legal');
    });
  });

  describe('ChecklistPriority', () => {
    it('should have all expected values', () => {
      expect(ChecklistPriority.CRITICAL).toBe('critical');
      expect(ChecklistPriority.HIGH).toBe('high');
      expect(ChecklistPriority.MEDIUM).toBe('medium');
      expect(ChecklistPriority.LOW).toBe('low');
    });
  });
});
