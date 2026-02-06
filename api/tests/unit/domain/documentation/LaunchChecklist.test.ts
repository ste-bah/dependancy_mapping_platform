/**
 * LaunchChecklist Unit Tests
 * @module tests/unit/domain/documentation/LaunchChecklist
 *
 * Tests for ChecklistItemVO and LaunchChecklistAggregate including:
 * - ChecklistItem creation and validation
 * - Item completion/uncompletion
 * - Blocker management
 * - Checklist item management
 * - Progress calculation
 * - Launch readiness assessment
 *
 * TASK-FINAL-004: Documentation system testing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ChecklistItemVO,
  LaunchChecklistAggregate,
  createChecklistItem,
  createLaunchChecklist,
  reconstituteChecklistItem,
  reconstituteLaunchChecklist,
  Result,
  ValidationError,
  DomainError,
} from '../../../../src/domain/documentation/index.js';
import type {
  CreateChecklistItemParams,
  CreateLaunchChecklistParams,
} from '../../../../src/domain/documentation/index.js';
import type {
  ChecklistItem,
  ChecklistCategory,
  ChecklistPriority,
  LaunchChecklist,
} from '../../../../src/types/documentation.js';

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create valid default parameters for ChecklistItem creation
 */
function createValidItemParams(overrides: Partial<CreateChecklistItemParams> = {}): CreateChecklistItemParams {
  return {
    category: 'infrastructure' as ChecklistCategory,
    description: 'Set up production database',
    priority: 'high' as ChecklistPriority,
    ...overrides,
  };
}

/**
 * Create valid ChecklistItem data for reconstitution
 */
function createValidItemData(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  const now = new Date().toISOString();
  return {
    id: 'item-id-123',
    category: 'security' as ChecklistCategory,
    description: 'Implement authentication',
    priority: 'critical' as ChecklistPriority,
    completed: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create valid LaunchChecklist data for reconstitution
 */
function createValidChecklistData(overrides: Partial<LaunchChecklist> = {}): LaunchChecklist {
  return {
    id: 'checklist-id-123',
    name: 'Launch Checklist Q1 2024',
    items: [],
    overallProgress: 0,
    readyForLaunch: false,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// ChecklistItemVO Tests
// ============================================================================

describe('ChecklistItemVO', () => {
  // ==========================================================================
  // Creation Tests
  // ==========================================================================

  describe('create', () => {
    it('should create a checklist item with valid data', () => {
      const result = createChecklistItem({
        category: 'infrastructure',
        description: 'Set up CI/CD pipeline',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.category).toBe('infrastructure');
        expect(result.value.description).toBe('Set up CI/CD pipeline');
        expect(result.value.completed).toBe(false);
        expect(result.value.id).toBeDefined();
      }
    });

    it('should accept all valid categories', () => {
      const validCategories: ChecklistCategory[] = [
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
        const result = createChecklistItem({
          category,
          description: `Test ${category}`,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.category).toBe(category);
        }
      }
    });

    it('should reject invalid category', () => {
      const result = createChecklistItem({
        category: 'invalid-category' as ChecklistCategory,
        description: 'Test item',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_VALUE');
        expect(result.error.field).toBe('category');
      }
    });

    it('should reject empty description', () => {
      const result = createChecklistItem({
        category: 'infrastructure',
        description: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('REQUIRED_FIELD');
        expect(result.error.field).toBe('description');
      }
    });

    it('should reject description exceeding 500 characters', () => {
      const longDescription = 'A'.repeat(501);
      const result = createChecklistItem({
        category: 'infrastructure',
        description: longDescription,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OUT_OF_RANGE');
        expect(result.error.field).toBe('description');
      }
    });

    it('should accept valid priority values', () => {
      const validPriorities: ChecklistPriority[] = ['critical', 'high', 'medium', 'low'];

      for (const priority of validPriorities) {
        const result = createChecklistItem({
          category: 'infrastructure',
          description: 'Test item',
          priority,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.priority).toBe(priority);
        }
      }
    });

    it('should reject invalid priority', () => {
      const result = createChecklistItem({
        category: 'infrastructure',
        description: 'Test item',
        priority: 'invalid' as ChecklistPriority,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_VALUE');
        expect(result.error.field).toBe('priority');
      }
    });

    it('should reject invalid due date format', () => {
      const result = createChecklistItem({
        category: 'infrastructure',
        description: 'Test item',
        dueDate: 'not-a-date',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_FORMAT');
        expect(result.error.field).toBe('dueDate');
      }
    });

    it('should accept valid due date', () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = createChecklistItem({
        category: 'infrastructure',
        description: 'Test item',
        dueDate,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.dueDate).toBe(dueDate);
      }
    });

    it('should accept blockedBy array', () => {
      const result = createChecklistItem({
        category: 'infrastructure',
        description: 'Test item',
        blockedBy: ['blocker-1', 'blocker-2'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.blockedBy).toEqual(['blocker-1', 'blocker-2']);
      }
    });
  });

  // ==========================================================================
  // Computed Properties Tests
  // ==========================================================================

  describe('computed properties', () => {
    it('should correctly identify critical items', () => {
      const criticalItem = reconstituteChecklistItem(
        createValidItemData({ priority: 'critical' })
      );
      const highItem = reconstituteChecklistItem(
        createValidItemData({ priority: 'high' })
      );

      expect(criticalItem.isCritical).toBe(true);
      expect(highItem.isCritical).toBe(false);
    });

    it('should correctly identify blocked items', () => {
      const blockedItem = reconstituteChecklistItem(
        createValidItemData({ blockedBy: ['blocker-id'] })
      );
      const unblockedItem = reconstituteChecklistItem(createValidItemData());

      expect(blockedItem.isBlocked).toBe(true);
      expect(unblockedItem.isBlocked).toBe(false);
    });

    it('should correctly identify overdue items', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const overdueItem = reconstituteChecklistItem(
        createValidItemData({ dueDate: pastDate, completed: false })
      );
      const notOverdueItem = reconstituteChecklistItem(
        createValidItemData({ dueDate: futureDate, completed: false })
      );
      const completedItem = reconstituteChecklistItem(
        createValidItemData({ dueDate: pastDate, completed: true })
      );

      expect(overdueItem.isOverdue).toBe(true);
      expect(notOverdueItem.isOverdue).toBe(false);
      expect(completedItem.isOverdue).toBe(false); // Completed items are not overdue
    });

    it('should correctly identify assigned items', () => {
      const assignedItem = reconstituteChecklistItem(
        createValidItemData({ assignee: 'user@test.com' })
      );
      const unassignedItem = reconstituteChecklistItem(createValidItemData());

      expect(assignedItem.isAssigned).toBe(true);
      expect(unassignedItem.isAssigned).toBe(false);
    });
  });

  // ==========================================================================
  // Value Object Methods Tests
  // ==========================================================================

  describe('value object methods', () => {
    it('should complete item', () => {
      const item = reconstituteChecklistItem(createValidItemData({ completed: false }));

      const completedItem = item.complete('user@test.com', 'Evidence link');

      expect(completedItem.completed).toBe(true);
      expect(completedItem.completedBy).toBe('user@test.com');
      expect(completedItem.completedAt).toBeDefined();
      expect(completedItem.evidence).toBe('Evidence link');
      // Original should be unchanged (immutability)
      expect(item.completed).toBe(false);
    });

    it('should return same instance when completing already completed item', () => {
      const item = reconstituteChecklistItem(
        createValidItemData({ completed: true, completedAt: new Date().toISOString() })
      );

      const result = item.complete('user@test.com');

      expect(result).toBe(item);
    });

    it('should uncomplete item', () => {
      const item = reconstituteChecklistItem(
        createValidItemData({
          completed: true,
          completedBy: 'user@test.com',
          completedAt: new Date().toISOString(),
          evidence: 'Some evidence',
        })
      );

      const uncompletedItem = item.uncomplete();

      expect(uncompletedItem.completed).toBe(false);
      expect(uncompletedItem.completedBy).toBeUndefined();
      expect(uncompletedItem.completedAt).toBeUndefined();
      expect(uncompletedItem.evidence).toBeUndefined();
    });

    it('should return same instance when uncompleting already uncompleted item', () => {
      const item = reconstituteChecklistItem(createValidItemData({ completed: false }));

      const result = item.uncomplete();

      expect(result).toBe(item);
    });

    it('should assign item', () => {
      const item = reconstituteChecklistItem(createValidItemData());

      const assignedItem = item.assign('newuser@test.com');

      expect(assignedItem.assignee).toBe('newuser@test.com');
    });

    it('should add notes', () => {
      const item = reconstituteChecklistItem(createValidItemData());

      const itemWithNotes = item.addNotes('Important note');

      expect(itemWithNotes.notes).toBe('Important note');
    });

    it('should set due date', () => {
      const item = reconstituteChecklistItem(createValidItemData());
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const itemWithDueDate = item.setDueDate(dueDate);

      expect(itemWithDueDate.dueDate).toBe(dueDate);
    });

    it('should add blocker', () => {
      const item = reconstituteChecklistItem(createValidItemData());

      const blockedItem = item.addBlocker('blocker-id');

      expect(blockedItem.blockedBy).toContain('blocker-id');
    });

    it('should not add duplicate blocker', () => {
      const item = reconstituteChecklistItem(
        createValidItemData({ blockedBy: ['blocker-id'] })
      );

      const blockedItem = item.addBlocker('blocker-id');

      expect(blockedItem.blockedBy?.filter(id => id === 'blocker-id').length).toBe(1);
    });

    it('should remove blocker', () => {
      const item = reconstituteChecklistItem(
        createValidItemData({ blockedBy: ['blocker-1', 'blocker-2'] })
      );

      const unblockedItem = item.removeBlocker('blocker-1');

      expect(unblockedItem.blockedBy).toEqual(['blocker-2']);
    });

    it('should return same instance when removing non-existent blocker', () => {
      const item = reconstituteChecklistItem(createValidItemData());

      const result = item.removeBlocker('non-existent');

      expect(result).toBe(item);
    });
  });

  // ==========================================================================
  // Serialization Tests
  // ==========================================================================

  describe('serialization', () => {
    it('should convert to JSON correctly', () => {
      const item = reconstituteChecklistItem(
        createValidItemData({
          assignee: 'user@test.com',
          notes: 'Test notes',
          blockedBy: ['blocker-1'],
        })
      );

      const json = item.toJSON();

      expect(json.id).toBe(item.id);
      expect(json.category).toBe(item.category);
      expect(json.description).toBe(item.description);
      expect(json.priority).toBe(item.priority);
      expect(json.completed).toBe(item.completed);
      expect(json.assignee).toBe('user@test.com');
      expect(json.notes).toBe('Test notes');
      expect(json.blockedBy).toEqual(['blocker-1']);
    });

    it('should check equality correctly', () => {
      const item1 = reconstituteChecklistItem(createValidItemData({ id: 'same-id' }));
      const item2 = reconstituteChecklistItem(createValidItemData({ id: 'same-id' }));
      const item3 = reconstituteChecklistItem(createValidItemData({ id: 'different-id' }));

      expect(item1.equals(item2)).toBe(true);
      expect(item1.equals(item3)).toBe(false);
    });

    it('should return meaningful string representation', () => {
      const item = reconstituteChecklistItem(
        createValidItemData({ id: 'item-123', description: 'Test description' })
      );

      const str = item.toString();

      expect(str).toContain('item-123');
      expect(str).toContain('Test description');
    });
  });
});

// ============================================================================
// LaunchChecklistAggregate Tests
// ============================================================================

describe('LaunchChecklistAggregate', () => {
  // ==========================================================================
  // Creation Tests
  // ==========================================================================

  describe('create', () => {
    it('should create empty checklist', () => {
      const checklist = createLaunchChecklist();

      expect(checklist.id).toBeDefined();
      expect(checklist.items).toEqual([]);
      expect(checklist.overallProgress).toBe(0);
      expect(checklist.readyForLaunch).toBe(true); // Empty = nothing blocking = ready
    });

    it('should create checklist with name', () => {
      const checklist = createLaunchChecklist({ name: 'Q1 Launch' });

      expect(checklist.name).toBe('Q1 Launch');
    });

    it('should create checklist with target launch date', () => {
      const targetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const checklist = createLaunchChecklist({ targetLaunchDate: targetDate });

      expect(checklist.targetLaunchDate).toBe(targetDate);
    });
  });

  // ==========================================================================
  // Reconstitution Tests
  // ==========================================================================

  describe('reconstitute', () => {
    it('should reconstitute from valid data', () => {
      const itemData = createValidItemData();
      const checklistData = createValidChecklistData({
        items: [itemData],
        overallProgress: 50,
      });

      const checklist = reconstituteLaunchChecklist(checklistData);

      expect(checklist.id).toBe(checklistData.id);
      expect(checklist.name).toBe(checklistData.name);
      expect(checklist.items.length).toBe(1);
    });
  });

  // ==========================================================================
  // Item Management Tests
  // ==========================================================================

  describe('item management', () => {
    it('should add item to checklist', () => {
      const checklist = createLaunchChecklist();
      const itemResult = createChecklistItem(createValidItemParams());

      expect(itemResult.success).toBe(true);
      if (itemResult.success) {
        checklist.addItem(itemResult.value);

        expect(checklist.totalItems).toBe(1);
      }
    });

    it('should throw error when adding duplicate item', () => {
      const checklist = createLaunchChecklist();
      const itemResult = createChecklistItem(createValidItemParams({ id: 'item-1' }));

      expect(itemResult.success).toBe(true);
      if (itemResult.success) {
        checklist.addItem(itemResult.value);

        expect(() => checklist.addItem(itemResult.value)).toThrow(DomainError);
        expect(() => checklist.addItem(itemResult.value)).toThrow('Item already exists in checklist');
      }
    });

    it('should create and add item', () => {
      const checklist = createLaunchChecklist();

      const result = checklist.createItem({
        category: 'security',
        description: 'Implement 2FA',
      });

      expect(result.success).toBe(true);
      expect(checklist.totalItems).toBe(1);
    });

    it('should get item by ID', () => {
      const checklist = createLaunchChecklist();
      const itemResult = createChecklistItem(createValidItemParams({ id: 'find-me' }));

      expect(itemResult.success).toBe(true);
      if (itemResult.success) {
        checklist.addItem(itemResult.value);

        const found = checklist.getItem('find-me');

        expect(found).toBeDefined();
        expect(found?.id).toBe('find-me');
      }
    });

    it('should return undefined for non-existent item', () => {
      const checklist = createLaunchChecklist();

      const found = checklist.getItem('non-existent');

      expect(found).toBeUndefined();
    });

    it('should update item', () => {
      const checklist = createLaunchChecklist();
      const itemResult = createChecklistItem(createValidItemParams({ id: 'update-me' }));

      expect(itemResult.success).toBe(true);
      if (itemResult.success) {
        checklist.addItem(itemResult.value);
        const updatedItem = itemResult.value.assign('new-assignee@test.com');

        checklist.updateItem('update-me', updatedItem);

        const found = checklist.getItem('update-me');
        expect(found?.assignee).toBe('new-assignee@test.com');
      }
    });

    it('should throw error when updating non-existent item', () => {
      const checklist = createLaunchChecklist();
      const itemResult = createChecklistItem(createValidItemParams());

      expect(itemResult.success).toBe(true);
      if (itemResult.success) {
        expect(() => checklist.updateItem('non-existent', itemResult.value)).toThrow(DomainError);
      }
    });

    it('should throw error when updating with mismatched ID', () => {
      const checklist = createLaunchChecklist();
      const item1Result = createChecklistItem(createValidItemParams({ id: 'item-1' }));
      const item2Result = createChecklistItem(createValidItemParams({ id: 'item-2' }));

      expect(item1Result.success).toBe(true);
      expect(item2Result.success).toBe(true);
      if (item1Result.success && item2Result.success) {
        checklist.addItem(item1Result.value);

        expect(() => checklist.updateItem('item-1', item2Result.value)).toThrow(DomainError);
        expect(() => checklist.updateItem('item-1', item2Result.value)).toThrow('Item ID mismatch');
      }
    });

    it('should remove item', () => {
      const checklist = createLaunchChecklist();
      const itemResult = createChecklistItem(createValidItemParams({ id: 'remove-me' }));

      expect(itemResult.success).toBe(true);
      if (itemResult.success) {
        checklist.addItem(itemResult.value);

        const removed = checklist.removeItem('remove-me');

        expect(removed).toBe(true);
        expect(checklist.totalItems).toBe(0);
      }
    });

    it('should return false when removing non-existent item', () => {
      const checklist = createLaunchChecklist();

      const removed = checklist.removeItem('non-existent');

      expect(removed).toBe(false);
    });

    it('should remove blockers when removing blocker item', () => {
      const checklist = createLaunchChecklist();
      const blockerResult = createChecklistItem(createValidItemParams({ id: 'blocker' }));
      const blockedResult = createChecklistItem(
        createValidItemParams({ id: 'blocked', blockedBy: ['blocker'] })
      );

      expect(blockerResult.success).toBe(true);
      expect(blockedResult.success).toBe(true);
      if (blockerResult.success && blockedResult.success) {
        checklist.addItem(blockerResult.value);
        checklist.addItem(blockedResult.value);

        checklist.removeItem('blocker');

        const blockedItem = checklist.getItem('blocked');
        // blockedBy can be undefined or empty array when no blockers remain
        expect(blockedItem?.blockedBy ?? []).toEqual([]);
      }
    });

    it('should complete item', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({ category: 'testing', description: 'Write tests', id: 'test-item' });

      checklist.completeItem('test-item', 'user@test.com', 'PR #123');

      const item = checklist.getItem('test-item');
      expect(item?.completed).toBe(true);
      expect(item?.completedBy).toBe('user@test.com');
      expect(item?.evidence).toBe('PR #123');
    });

    it('should throw error when completing non-existent item', () => {
      const checklist = createLaunchChecklist();

      expect(() => checklist.completeItem('non-existent')).toThrow(DomainError);
    });

    it('should uncomplete item', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({ category: 'testing', description: 'Write tests', id: 'test-item' });
      checklist.completeItem('test-item');

      checklist.uncompleteItem('test-item');

      const item = checklist.getItem('test-item');
      expect(item?.completed).toBe(false);
    });
  });

  // ==========================================================================
  // Query Methods Tests
  // ==========================================================================

  describe('query methods', () => {
    let checklist: LaunchChecklistAggregate;

    beforeEach(() => {
      checklist = createLaunchChecklist();
      // Add test items
      checklist.createItem({
        id: 'infra-1',
        category: 'infrastructure',
        description: 'Setup servers',
        priority: 'critical',
      });
      checklist.createItem({
        id: 'infra-2',
        category: 'infrastructure',
        description: 'Configure DNS',
        priority: 'high',
      });
      checklist.createItem({
        id: 'security-1',
        category: 'security',
        description: 'Security audit',
        priority: 'critical',
      });
      checklist.createItem({
        id: 'testing-1',
        category: 'testing',
        description: 'E2E tests',
        priority: 'high',
        blockedBy: ['infra-1'],
      });
    });

    it('should get items by category', () => {
      const infraItems = checklist.getItemsByCategory('infrastructure');

      expect(infraItems.length).toBe(2);
      expect(infraItems.every(item => item.category === 'infrastructure')).toBe(true);
    });

    it('should get items by priority', () => {
      const criticalItems = checklist.getItemsByPriority('critical');

      expect(criticalItems.length).toBe(2);
      expect(criticalItems.every(item => item.priority === 'critical')).toBe(true);
    });

    it('should get incomplete items', () => {
      checklist.completeItem('infra-1');

      const incompleteItems = checklist.getIncompleteItems();

      expect(incompleteItems.length).toBe(3);
      expect(incompleteItems.every(item => !item.completed)).toBe(true);
    });

    it('should get blocked items', () => {
      const blockedItems = checklist.getBlockedItems();

      expect(blockedItems.length).toBe(1);
      expect(blockedItems[0].id).toBe('testing-1');
    });

    it('should get critical incomplete items', () => {
      checklist.completeItem('infra-1');

      const criticalIncomplete = checklist.getCriticalIncomplete();

      expect(criticalIncomplete.length).toBe(1);
      expect(criticalIncomplete[0].id).toBe('security-1');
    });
  });

  // ==========================================================================
  // Progress Calculation Tests
  // ==========================================================================

  describe('progress calculation', () => {
    it('should calculate overall progress correctly', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({ category: 'testing', description: 'Item 1', id: 'item-1' });
      checklist.createItem({ category: 'testing', description: 'Item 2', id: 'item-2' });
      checklist.createItem({ category: 'testing', description: 'Item 3', id: 'item-3' });
      checklist.createItem({ category: 'testing', description: 'Item 4', id: 'item-4' });

      expect(checklist.overallProgress).toBe(0);

      checklist.completeItem('item-1');
      expect(checklist.overallProgress).toBe(25);

      checklist.completeItem('item-2');
      expect(checklist.overallProgress).toBe(50);

      checklist.completeItem('item-3');
      expect(checklist.overallProgress).toBe(75);

      checklist.completeItem('item-4');
      expect(checklist.overallProgress).toBe(100);
    });

    it('should return 0 for empty checklist', () => {
      const checklist = createLaunchChecklist();

      expect(checklist.overallProgress).toBe(0);
    });

    it('should calculate progress by category', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({
        category: 'security',
        description: 'Security 1',
        id: 's1',
        priority: 'critical',
      });
      checklist.createItem({ category: 'security', description: 'Security 2', id: 's2' });
      checklist.createItem({ category: 'testing', description: 'Testing 1', id: 't1' });
      checklist.completeItem('s1');

      const progress = checklist.getProgressByCategory();

      const securityProgress = progress.find(p => p.category === 'security');
      const testingProgress = progress.find(p => p.category === 'testing');

      expect(securityProgress).toBeDefined();
      expect(securityProgress?.total).toBe(2);
      expect(securityProgress?.completed).toBe(1);
      expect(securityProgress?.percentage).toBe(50);
      expect(securityProgress?.criticalRemaining).toBe(0);

      expect(testingProgress).toBeDefined();
      expect(testingProgress?.total).toBe(1);
      expect(testingProgress?.completed).toBe(0);
      expect(testingProgress?.percentage).toBe(0);
    });
  });

  // ==========================================================================
  // Launch Readiness Tests
  // ==========================================================================

  describe('launch readiness', () => {
    it('should be ready when all critical items completed', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({
        category: 'security',
        description: 'Critical 1',
        id: 'c1',
        priority: 'critical',
      });
      checklist.createItem({
        category: 'security',
        description: 'Critical 2',
        id: 'c2',
        priority: 'critical',
      });
      checklist.createItem({ category: 'testing', description: 'High 1', id: 'h1', priority: 'high' });

      expect(checklist.readyForLaunch).toBe(false);

      checklist.completeItem('c1');
      expect(checklist.readyForLaunch).toBe(false);

      checklist.completeItem('c2');
      expect(checklist.readyForLaunch).toBe(true); // All critical complete, even with incomplete high
    });

    it('should be ready when empty checklist', () => {
      const checklist = createLaunchChecklist();

      expect(checklist.readyForLaunch).toBe(true); // Empty checklist = nothing blocking launch
    });

    it('should be ready when no critical items and 100% progress', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({ category: 'testing', description: 'High 1', id: 'h1', priority: 'high' });
      checklist.completeItem('h1');

      expect(checklist.readyForLaunch).toBe(true);
    });

    it('should generate readiness summary', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({
        category: 'security',
        description: 'Critical 1',
        id: 'c1',
        priority: 'critical',
      });
      checklist.createItem({
        category: 'testing',
        description: 'Blocked item',
        id: 'b1',
        blockedBy: ['c1'],
      });
      checklist.completeItem('c1');

      const summary = checklist.getReadinessSummary();

      expect(summary.readyForLaunch).toBe(true);
      expect(summary.overallProgress).toBe(50);
      expect(summary.totalItems).toBe(2);
      expect(summary.completedItems).toBe(1);
      expect(summary.criticalItems).toBe(1);
      expect(summary.criticalCompleted).toBe(1);
      expect(summary.blockedItems).toBe(1);
      expect(summary.progressByCategory.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Target Date Management Tests
  // ==========================================================================

  describe('target date management', () => {
    it('should set target launch date', () => {
      const checklist = createLaunchChecklist();
      const targetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      checklist.setTargetLaunchDate(targetDate);

      expect(checklist.targetLaunchDate).toBe(targetDate);
    });

    it('should throw error for invalid date format', () => {
      const checklist = createLaunchChecklist();

      expect(() => checklist.setTargetLaunchDate('not-a-date')).toThrow(DomainError);
      expect(() => checklist.setTargetLaunchDate('not-a-date')).toThrow('Invalid date format');
    });

    it('should clear target launch date', () => {
      const checklist = createLaunchChecklist({
        targetLaunchDate: new Date().toISOString(),
      });

      checklist.clearTargetLaunchDate();

      expect(checklist.targetLaunchDate).toBeUndefined();
    });
  });

  // ==========================================================================
  // Serialization Tests
  // ==========================================================================

  describe('serialization', () => {
    it('should convert to JSON correctly', () => {
      const checklist = createLaunchChecklist({ name: 'Test Checklist' });
      checklist.createItem({
        category: 'testing',
        description: 'Test item',
        id: 'item-1',
      });
      checklist.completeItem('item-1');

      const json = checklist.toJSON();

      expect(json.id).toBe(checklist.id);
      expect(json.name).toBe('Test Checklist');
      expect(json.items.length).toBe(1);
      expect(json.overallProgress).toBe(100);
      expect(json.readyForLaunch).toBe(true);
    });

    it('should return meaningful string representation', () => {
      const checklist = createLaunchChecklist({ id: 'checklist-123' });
      checklist.createItem({ category: 'testing', description: 'Item 1' });
      checklist.createItem({ category: 'testing', description: 'Item 2' });
      checklist.completeItem(checklist.items[0].id);

      const str = checklist.toString();

      expect(str).toContain('checklist-123');
      expect(str).toContain('2 items');
      expect(str).toContain('50%');
    });
  });

  // ==========================================================================
  // Metrics Tests
  // ==========================================================================

  describe('metrics', () => {
    it('should track total items', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({ category: 'testing', description: 'Item 1' });
      checklist.createItem({ category: 'testing', description: 'Item 2' });

      expect(checklist.totalItems).toBe(2);
    });

    it('should track completed items', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({ category: 'testing', description: 'Item 1', id: 'i1' });
      checklist.createItem({ category: 'testing', description: 'Item 2', id: 'i2' });
      checklist.completeItem('i1');

      expect(checklist.completedItems).toBe(1);
    });

    it('should track blocked items', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({ category: 'testing', description: 'Blocker', id: 'blocker' });
      checklist.createItem({
        category: 'testing',
        description: 'Blocked',
        id: 'blocked',
        blockedBy: ['blocker'],
      });

      expect(checklist.blockedItems).toBe(1);
    });

    it('should track critical items', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({
        category: 'security',
        description: 'Critical',
        priority: 'critical',
        id: 'c1',
      });
      checklist.createItem({ category: 'testing', description: 'High', priority: 'high' });

      expect(checklist.criticalItems).toBe(1);
    });

    it('should track critical completed', () => {
      const checklist = createLaunchChecklist();
      checklist.createItem({
        category: 'security',
        description: 'Critical 1',
        priority: 'critical',
        id: 'c1',
      });
      checklist.createItem({
        category: 'security',
        description: 'Critical 2',
        priority: 'critical',
        id: 'c2',
      });
      checklist.completeItem('c1');

      expect(checklist.criticalCompleted).toBe(1);
    });
  });
});
