/**
 * BetaCustomerEntity Unit Tests
 * @module tests/unit/domain/documentation/BetaCustomer
 *
 * Tests for the BetaCustomerEntity domain entity including:
 * - Creation and validation
 * - Email validation
 * - NDA signing flow
 * - Onboarding status transitions
 * - Customer tier management
 * - Activity tracking
 *
 * TASK-FINAL-004: Documentation system testing
 */

import { describe, it, expect } from 'vitest';
import {
  BetaCustomerEntity,
  createBetaCustomer,
  reconstituteBetaCustomer,
  Result,
  ValidationError,
  DomainError,
} from '../../../../src/domain/documentation/index.js';
import type { CreateBetaCustomerParams, BetaCustomerData } from '../../../../src/domain/documentation/index.js';
import type { OnboardingStatus, BetaCustomerTier } from '../../../../src/types/documentation.js';

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create valid default parameters for BetaCustomer creation
 */
function createValidParams(overrides: Partial<CreateBetaCustomerParams> = {}): CreateBetaCustomerParams {
  return {
    companyName: 'Acme Corporation',
    contactEmail: 'contact@acme.com',
    contactName: 'John Doe',
    ...overrides,
  };
}

/**
 * Create valid BetaCustomerData for reconstitution
 */
function createValidData(overrides: Partial<BetaCustomerData> = {}): BetaCustomerData {
  const now = new Date().toISOString();
  return {
    id: 'test-customer-id-123',
    companyName: 'Test Company',
    contactEmail: 'test@company.com',
    ndaSigned: false,
    onboardingStatus: 'pending' as OnboardingStatus,
    createdAt: now,
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('BetaCustomerEntity', () => {
  // ==========================================================================
  // Creation Tests
  // ==========================================================================

  describe('create', () => {
    it('should create a beta customer with valid data', () => {
      const result = createBetaCustomer({
        companyName: 'Acme Corp',
        contactEmail: 'contact@acme.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.companyName).toBe('Acme Corp');
        expect(result.value.contactEmail).toBe('contact@acme.com');
        expect(result.value.ndaSigned).toBe(false);
        expect(result.value.onboardingStatus).toBe('pending');
        expect(result.value.feedbackCount).toBe(0);
      }
    });

    it('should normalize email to lowercase', () => {
      const result = createBetaCustomer({
        companyName: 'Test Company',
        contactEmail: 'TEST@COMPANY.COM',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.contactEmail).toBe('test@company.com');
      }
    });

    it('should trim company name and email', () => {
      const result = createBetaCustomer({
        companyName: '  Acme Corp  ',
        contactEmail: '  contact@acme.com  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.companyName).toBe('Acme Corp');
        expect(result.value.contactEmail).toBe('contact@acme.com');
      }
    });

    it('should reject empty company name', () => {
      const result = createBetaCustomer({
        companyName: '',
        contactEmail: 'contact@acme.com',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.code).toBe('REQUIRED_FIELD');
        expect(result.error.field).toBe('companyName');
      }
    });

    it('should reject whitespace-only company name', () => {
      const result = createBetaCustomer({
        companyName: '   ',
        contactEmail: 'contact@acme.com',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_VALUE');
      }
    });

    it('should reject company name exceeding 200 characters', () => {
      const longName = 'A'.repeat(201);
      const result = createBetaCustomer({
        companyName: longName,
        contactEmail: 'contact@acme.com',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OUT_OF_RANGE');
        expect(result.error.field).toBe('companyName');
      }
    });

    it('should reject empty email', () => {
      const result = createBetaCustomer({
        companyName: 'Acme Corp',
        contactEmail: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('REQUIRED_FIELD');
        expect(result.error.field).toBe('contactEmail');
      }
    });

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        'double@@at.com',
      ];

      for (const email of invalidEmails) {
        const result = createBetaCustomer({
          companyName: 'Acme Corp',
          contactEmail: email,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('INVALID_FORMAT');
          expect(result.error.field).toBe('contactEmail');
        }
      }
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'simple@example.com',
        'user.name@domain.com',
        'user+tag@example.org',
        'user123@sub.domain.com',
      ];

      for (const email of validEmails) {
        const result = createBetaCustomer({
          companyName: 'Acme Corp',
          contactEmail: email,
        });

        expect(result.success).toBe(true);
      }
    });

    it('should accept valid tier values', () => {
      const validTiers: BetaCustomerTier[] = ['design-partner', 'early-adopter', 'beta-tester'];

      for (const tier of validTiers) {
        const result = createBetaCustomer({
          companyName: 'Test Company',
          contactEmail: 'test@company.com',
          tier,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.tier).toBe(tier);
        }
      }
    });

    it('should reject invalid tier value', () => {
      const result = createBetaCustomer({
        companyName: 'Test Company',
        contactEmail: 'test@company.com',
        tier: 'invalid-tier' as BetaCustomerTier,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_VALUE');
        expect(result.error.field).toBe('tier');
      }
    });

    it('should set timestamps on creation', () => {
      const beforeCreate = new Date().toISOString();
      const result = createBetaCustomer({
        companyName: 'Acme Corp',
        contactEmail: 'contact@acme.com',
      });
      const afterCreate = new Date().toISOString();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.createdAt).toBeDefined();
        expect(result.value.createdAt >= beforeCreate).toBe(true);
        expect(result.value.createdAt <= afterCreate).toBe(true);
      }
    });

    it('should accept all optional parameters', () => {
      const result = createBetaCustomer({
        companyName: 'Complete Company',
        contactEmail: 'complete@company.com',
        contactName: 'John Smith',
        tier: 'design-partner',
        notes: 'Important customer notes',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.contactName).toBe('John Smith');
        expect(result.value.tier).toBe('design-partner');
        expect(result.value.notes).toBe('Important customer notes');
      }
    });
  });

  // ==========================================================================
  // Reconstitution Tests
  // ==========================================================================

  describe('reconstitute', () => {
    it('should reconstitute from valid data', () => {
      const data = createValidData();
      const customer = reconstituteBetaCustomer(data);

      expect(customer.id).toBe(data.id);
      expect(customer.companyName).toBe(data.companyName);
      expect(customer.contactEmail).toBe(data.contactEmail);
      expect(customer.ndaSigned).toBe(data.ndaSigned);
      expect(customer.onboardingStatus).toBe(data.onboardingStatus);
    });

    it('should preserve all optional fields', () => {
      const data = createValidData({
        contactName: 'Jane Doe',
        ndaSigned: true,
        ndaSignedAt: new Date().toISOString(),
        tier: 'early-adopter',
        notes: 'Test notes',
        feedbackCount: 5,
        lastActiveAt: new Date().toISOString(),
      });

      const customer = reconstituteBetaCustomer(data);

      expect(customer.contactName).toBe('Jane Doe');
      expect(customer.ndaSigned).toBe(true);
      expect(customer.ndaSignedAt).toBeDefined();
      expect(customer.tier).toBe('early-adopter');
      expect(customer.notes).toBe('Test notes');
      expect(customer.feedbackCount).toBe(5);
      expect(customer.lastActiveAt).toBeDefined();
    });
  });

  // ==========================================================================
  // Computed Properties Tests
  // ==========================================================================

  describe('computed properties', () => {
    it('should correctly identify canStartOnboarding', () => {
      const customerWithNda = reconstituteBetaCustomer(
        createValidData({ ndaSigned: true, onboardingStatus: 'pending' })
      );
      const customerWithoutNda = reconstituteBetaCustomer(
        createValidData({ ndaSigned: false, onboardingStatus: 'pending' })
      );
      const customerAlreadyOnboarding = reconstituteBetaCustomer(
        createValidData({ ndaSigned: true, onboardingStatus: 'in-progress' })
      );

      expect(customerWithNda.canStartOnboarding).toBe(true);
      expect(customerWithoutNda.canStartOnboarding).toBe(false);
      expect(customerAlreadyOnboarding.canStartOnboarding).toBe(false);
    });

    it('should correctly identify isOnboarding', () => {
      const onboarding = reconstituteBetaCustomer(
        createValidData({ onboardingStatus: 'in-progress' })
      );
      const pending = reconstituteBetaCustomer(
        createValidData({ onboardingStatus: 'pending' })
      );

      expect(onboarding.isOnboarding).toBe(true);
      expect(pending.isOnboarding).toBe(false);
    });

    it('should correctly identify hasCompletedOnboarding', () => {
      const completed = reconstituteBetaCustomer(
        createValidData({ onboardingStatus: 'completed' })
      );
      const inProgress = reconstituteBetaCustomer(
        createValidData({ onboardingStatus: 'in-progress' })
      );

      expect(completed.hasCompletedOnboarding).toBe(true);
      expect(inProgress.hasCompletedOnboarding).toBe(false);
    });

    it('should correctly identify hasChurned', () => {
      const churned = reconstituteBetaCustomer(
        createValidData({ onboardingStatus: 'churned' })
      );
      const active = reconstituteBetaCustomer(
        createValidData({ onboardingStatus: 'in-progress' })
      );

      expect(churned.hasChurned).toBe(true);
      expect(active.hasChurned).toBe(false);
    });

    it('should correctly identify isDesignPartner', () => {
      const designPartner = reconstituteBetaCustomer(
        createValidData({ tier: 'design-partner' })
      );
      const betaTester = reconstituteBetaCustomer(
        createValidData({ tier: 'beta-tester' })
      );

      expect(designPartner.isDesignPartner).toBe(true);
      expect(betaTester.isDesignPartner).toBe(false);
    });

    it('should correctly identify isRecentlyActive', () => {
      const recentlyActive = reconstituteBetaCustomer(
        createValidData({ lastActiveAt: new Date().toISOString() })
      );
      const notActive = reconstituteBetaCustomer(createValidData());
      const oldActive = reconstituteBetaCustomer(
        createValidData({
          lastActiveAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        })
      );

      expect(recentlyActive.isRecentlyActive).toBe(true);
      expect(notActive.isRecentlyActive).toBe(false);
      expect(oldActive.isRecentlyActive).toBe(false);
    });
  });

  // ==========================================================================
  // Update Methods Tests
  // ==========================================================================

  describe('update methods', () => {
    it('should update company name', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      customer.updateCompanyName('New Company Name');

      expect(customer.companyName).toBe('New Company Name');
    });

    it('should throw error for empty company name update', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      expect(() => customer.updateCompanyName('')).toThrow(DomainError);
      expect(() => customer.updateCompanyName('   ')).toThrow(DomainError);
    });

    it('should throw error for company name exceeding max length', () => {
      const customer = reconstituteBetaCustomer(createValidData());
      const longName = 'A'.repeat(201);

      expect(() => customer.updateCompanyName(longName)).toThrow(DomainError);
    });

    it('should update contact email', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      customer.updateContactEmail('new@email.com');

      expect(customer.contactEmail).toBe('new@email.com');
    });

    it('should throw error for invalid email update', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      expect(() => customer.updateContactEmail('invalid-email')).toThrow(DomainError);
    });

    it('should update contact name', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      customer.updateContactName('New Contact');

      expect(customer.contactName).toBe('New Contact');
    });

    it('should allow clearing contact name', () => {
      const customer = reconstituteBetaCustomer(
        createValidData({ contactName: 'Existing Name' })
      );

      customer.updateContactName(undefined);

      expect(customer.contactName).toBeUndefined();
    });

    it('should set valid tier', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      customer.setTier('design-partner');

      expect(customer.tier).toBe('design-partner');
    });

    it('should throw error for invalid tier', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      expect(() => customer.setTier('invalid' as BetaCustomerTier)).toThrow(DomainError);
    });

    it('should update notes', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      customer.updateNotes('New notes');

      expect(customer.notes).toBe('New notes');
    });
  });

  // ==========================================================================
  // Activity Tracking Tests
  // ==========================================================================

  describe('activity tracking', () => {
    it('should record feedback', () => {
      const result = createBetaCustomer({
        companyName: 'Test',
        contactEmail: 'test@test.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const customer = result.value;

        customer.recordFeedback();
        customer.recordFeedback();
        customer.recordFeedback();

        expect(customer.feedbackCount).toBe(3);
        expect(customer.lastActiveAt).toBeDefined();
      }
    });

    it('should record activity', () => {
      const customer = reconstituteBetaCustomer(createValidData());
      const beforeActivity = new Date().toISOString();

      customer.recordActivity();

      expect(customer.lastActiveAt).toBeDefined();
      expect(customer.lastActiveAt! >= beforeActivity).toBe(true);
    });
  });

  // ==========================================================================
  // NDA Methods Tests
  // ==========================================================================

  describe('NDA management', () => {
    it('should sign NDA', () => {
      const customer = reconstituteBetaCustomer(createValidData({ ndaSigned: false }));

      customer.signNDA('admin@company.com');

      expect(customer.ndaSigned).toBe(true);
      expect(customer.ndaSignedAt).toBeDefined();
      expect(customer.notes).toContain('NDA processed by: admin@company.com');
    });

    it('should sign NDA without signed by', () => {
      const customer = reconstituteBetaCustomer(createValidData({ ndaSigned: false }));

      customer.signNDA();

      expect(customer.ndaSigned).toBe(true);
      expect(customer.ndaSignedAt).toBeDefined();
    });

    it('should throw error when signing already signed NDA', () => {
      const customer = reconstituteBetaCustomer(
        createValidData({ ndaSigned: true, ndaSignedAt: new Date().toISOString() })
      );

      expect(() => customer.signNDA()).toThrow(DomainError);
      expect(() => customer.signNDA()).toThrow('NDA already signed');
    });

    it('should revoke NDA', () => {
      const customer = reconstituteBetaCustomer(
        createValidData({
          ndaSigned: true,
          ndaSignedAt: new Date().toISOString(),
          onboardingStatus: 'pending',
        })
      );

      customer.revokeNDA('Customer requested');

      expect(customer.ndaSigned).toBe(false);
      expect(customer.ndaSignedAt).toBeUndefined();
      expect(customer.notes).toContain('NDA revoked: Customer requested');
    });

    it('should throw error when revoking non-existent NDA', () => {
      const customer = reconstituteBetaCustomer(createValidData({ ndaSigned: false }));

      expect(() => customer.revokeNDA('reason')).toThrow(DomainError);
      expect(() => customer.revokeNDA('reason')).toThrow('No NDA to revoke');
    });

    it('should throw error when revoking NDA after onboarding started', () => {
      const customer = reconstituteBetaCustomer(
        createValidData({
          ndaSigned: true,
          ndaSignedAt: new Date().toISOString(),
          onboardingStatus: 'in-progress',
        })
      );

      expect(() => customer.revokeNDA('reason')).toThrow(DomainError);
      expect(() => customer.revokeNDA('reason')).toThrow('Cannot revoke NDA after onboarding has started');
    });
  });

  // ==========================================================================
  // Onboarding Status Tests
  // ==========================================================================

  describe('onboarding status transitions', () => {
    describe('startOnboarding', () => {
      it('should start onboarding with signed NDA', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ ndaSigned: true, onboardingStatus: 'pending' })
        );

        customer.startOnboarding();

        expect(customer.onboardingStatus).toBe('in-progress');
        expect(customer.lastActiveAt).toBeDefined();
      });

      it('should throw error without signed NDA', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ ndaSigned: false, onboardingStatus: 'pending' })
        );

        expect(() => customer.startOnboarding()).toThrow(DomainError);
        expect(() => customer.startOnboarding()).toThrow('NDA must be signed before starting onboarding');
      });

      it('should throw error when not in pending status', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ ndaSigned: true, onboardingStatus: 'in-progress' })
        );

        expect(() => customer.startOnboarding()).toThrow(DomainError);
        expect(() => customer.startOnboarding()).toThrow('Onboarding has already started or completed');
      });
    });

    describe('completeOnboarding', () => {
      it('should complete onboarding from in-progress', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ ndaSigned: true, onboardingStatus: 'in-progress' })
        );

        customer.completeOnboarding();

        expect(customer.onboardingStatus).toBe('completed');
        expect(customer.lastActiveAt).toBeDefined();
      });

      it('should throw error when not in-progress', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ onboardingStatus: 'pending' })
        );

        expect(() => customer.completeOnboarding()).toThrow(DomainError);
        expect(() => customer.completeOnboarding()).toThrow('Onboarding must be in progress to complete');
      });
    });

    describe('advanceOnboarding', () => {
      it('should advance from pending to in-progress', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ ndaSigned: true, onboardingStatus: 'pending' })
        );

        customer.advanceOnboarding();

        expect(customer.onboardingStatus).toBe('in-progress');
      });

      it('should advance from in-progress to completed', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ ndaSigned: true, onboardingStatus: 'in-progress' })
        );

        customer.advanceOnboarding();

        expect(customer.onboardingStatus).toBe('completed');
      });

      it('should throw error when cannot advance', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ onboardingStatus: 'completed' })
        );

        expect(() => customer.advanceOnboarding()).toThrow(DomainError);
      });
    });

    describe('markAsChurned', () => {
      it('should mark customer as churned', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ onboardingStatus: 'in-progress' })
        );

        customer.markAsChurned('Lost interest');

        expect(customer.onboardingStatus).toBe('churned');
        expect(customer.notes).toContain('Churned: Lost interest');
      });

      it('should be idempotent for already churned customer', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ onboardingStatus: 'churned' })
        );

        expect(() => customer.markAsChurned('Again')).not.toThrow();
        expect(customer.onboardingStatus).toBe('churned');
      });
    });

    describe('reactivate', () => {
      it('should reactivate churned customer to in-progress (with NDA)', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({
            ndaSigned: true,
            onboardingStatus: 'churned',
          })
        );

        customer.reactivate();

        expect(customer.onboardingStatus).toBe('in-progress');
        expect(customer.notes).toContain('Reactivated to: in-progress');
      });

      it('should reactivate churned customer to pending (without NDA)', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({
            ndaSigned: false,
            onboardingStatus: 'churned',
          })
        );

        customer.reactivate();

        expect(customer.onboardingStatus).toBe('pending');
      });

      it('should reactivate to specified status', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({
            ndaSigned: true,
            onboardingStatus: 'churned',
          })
        );

        customer.reactivate('pending');

        expect(customer.onboardingStatus).toBe('pending');
      });

      it('should throw error when not churned', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ onboardingStatus: 'in-progress' })
        );

        expect(() => customer.reactivate()).toThrow(DomainError);
        expect(() => customer.reactivate()).toThrow('Only churned customers can be reactivated');
      });

      it('should throw error when reactivating to churned', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({ onboardingStatus: 'churned' })
        );

        expect(() => customer.reactivate('churned')).toThrow(DomainError);
        expect(() => customer.reactivate('churned')).toThrow('Cannot reactivate to churned status');
      });

      it('should throw error when reactivating to active status without NDA', () => {
        const customer = reconstituteBetaCustomer(
          createValidData({
            ndaSigned: false,
            onboardingStatus: 'churned',
          })
        );

        expect(() => customer.reactivate('in-progress')).toThrow(DomainError);
        expect(() => customer.reactivate('in-progress')).toThrow('Cannot restore to active onboarding without signed NDA');
      });
    });
  });

  // ==========================================================================
  // Serialization Tests
  // ==========================================================================

  describe('serialization', () => {
    it('should convert to JSON correctly', () => {
      const customer = reconstituteBetaCustomer(
        createValidData({
          contactName: 'Test Contact',
          tier: 'design-partner',
          notes: 'Test notes',
        })
      );

      const json = customer.toJSON();

      expect(json.id).toBe(customer.id);
      expect(json.companyName).toBe(customer.companyName);
      expect(json.contactEmail).toBe(customer.contactEmail);
      expect(json.contactName).toBe('Test Contact');
      expect(json.ndaSigned).toBe(customer.ndaSigned);
      expect(json.onboardingStatus).toBe(customer.onboardingStatus);
      expect(json.tier).toBe('design-partner');
      expect(json.notes).toBe('Test notes');
    });

    it('should convert to summary correctly', () => {
      const customer = reconstituteBetaCustomer(
        createValidData({ tier: 'early-adopter' })
      );

      const summary = customer.toSummary();

      expect(summary.id).toBe(customer.id);
      expect(summary.companyName).toBe(customer.companyName);
      expect(summary.contactEmail).toBe(customer.contactEmail);
      expect(summary.ndaSigned).toBe(customer.ndaSigned);
      expect(summary.onboardingStatus).toBe(customer.onboardingStatus);
      expect(summary.tier).toBe('early-adopter');
      // Summary should not include notes
      expect((summary as Record<string, unknown>).notes).toBeUndefined();
    });
  });

  // ==========================================================================
  // Equality Tests
  // ==========================================================================

  describe('equality', () => {
    it('should return true for same ID', () => {
      const customer1 = reconstituteBetaCustomer(createValidData({ id: 'same-id' }));
      const customer2 = reconstituteBetaCustomer(
        createValidData({ id: 'same-id', companyName: 'Different Name' })
      );

      expect(customer1.equals(customer2)).toBe(true);
    });

    it('should return false for different ID', () => {
      const customer1 = reconstituteBetaCustomer(createValidData({ id: 'id-1' }));
      const customer2 = reconstituteBetaCustomer(createValidData({ id: 'id-2' }));

      expect(customer1.equals(customer2)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      const customer = reconstituteBetaCustomer(createValidData());

      expect(customer.equals(null as unknown as BetaCustomerEntity)).toBe(false);
      expect(customer.equals(undefined as unknown as BetaCustomerEntity)).toBe(false);
    });
  });

  // ==========================================================================
  // String Representation Tests
  // ==========================================================================

  describe('toString', () => {
    it('should return meaningful string representation', () => {
      const customer = reconstituteBetaCustomer(
        createValidData({
          id: 'customer-123',
          companyName: 'Acme Corp',
          onboardingStatus: 'in-progress',
        })
      );

      const str = customer.toString();

      expect(str).toContain('customer-123');
      expect(str).toContain('Acme Corp');
      expect(str).toContain('in-progress');
    });
  });
});
