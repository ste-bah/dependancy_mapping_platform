/**
 * Beta Customer Entity
 * @module domain/documentation/BetaCustomer
 *
 * Aggregate root for beta customer management. Handles customer onboarding,
 * NDA tracking, and lifecycle states for beta program participants.
 *
 * TASK-FINAL-004: Documentation system domain implementation
 */

import { randomUUID } from 'crypto';
import {
  BetaCustomer as BetaCustomerType,
  BetaCustomerSummary,
  OnboardingStatus,
  BetaCustomerTier,
} from '../../types/documentation.js';
import { Result, ValidationResult, ValidationError, DomainError } from './result.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for creating a new beta customer
 */
export interface CreateBetaCustomerParams {
  companyName: string;
  contactEmail: string;
  contactName?: string;
  tier?: BetaCustomerTier;
  notes?: string;
  id?: string;
}

/**
 * Parameters for reconstituting a customer from persistence
 */
export interface BetaCustomerData {
  id: string;
  companyName: string;
  contactEmail: string;
  contactName?: string;
  ndaSigned: boolean;
  ndaSignedAt?: string;
  onboardingStatus: OnboardingStatus;
  tier?: BetaCustomerTier;
  notes?: string;
  feedbackCount?: number;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================================================
// Beta Customer Entity
// ============================================================================

/**
 * Beta Customer Aggregate Root
 *
 * Represents a beta program participant with onboarding state, NDA tracking,
 * and activity monitoring. Enforces business rules around customer lifecycle.
 *
 * @example
 * ```typescript
 * const result = BetaCustomerEntity.create({
 *   companyName: 'Acme Corp',
 *   contactEmail: 'john@acme.com',
 *   contactName: 'John Doe',
 *   tier: 'design-partner',
 * });
 *
 * if (Result.isOk(result)) {
 *   result.value.signNDA('admin@company.com');
 *   result.value.startOnboarding();
 * }
 * ```
 */
export class BetaCustomerEntity implements BetaCustomerType {
  /** Unique customer identifier (immutable) */
  public readonly id: string;

  /** Company name */
  private _companyName: string;

  /** Primary contact email */
  private _contactEmail: string;

  /** Primary contact name */
  private _contactName?: string;

  /** Whether NDA has been signed */
  private _ndaSigned: boolean;

  /** NDA signature timestamp */
  private _ndaSignedAt?: string;

  /** Onboarding status */
  private _onboardingStatus: OnboardingStatus;

  /** Customer tier */
  private _tier?: BetaCustomerTier;

  /** Internal notes */
  private _notes?: string;

  /** Number of feedback items received */
  private _feedbackCount: number;

  /** Last activity timestamp */
  private _lastActiveAt?: string;

  /** Creation timestamp */
  private _createdAt: string;

  /** Last update timestamp */
  private _updatedAt?: string;

  // ==========================================================================
  // Private Constructor
  // ==========================================================================

  private constructor(data: BetaCustomerData) {
    this.id = data.id;
    this._companyName = data.companyName;
    this._contactEmail = data.contactEmail;
    this._contactName = data.contactName;
    this._ndaSigned = data.ndaSigned;
    this._ndaSignedAt = data.ndaSignedAt;
    this._onboardingStatus = data.onboardingStatus;
    this._tier = data.tier;
    this._notes = data.notes;
    this._feedbackCount = data.feedbackCount ?? 0;
    this._lastActiveAt = data.lastActiveAt;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  // ==========================================================================
  // Getters (Read-Only Access)
  // ==========================================================================

  get companyName(): string {
    return this._companyName;
  }

  get contactEmail(): string {
    return this._contactEmail;
  }

  get contactName(): string | undefined {
    return this._contactName;
  }

  get ndaSigned(): boolean {
    return this._ndaSigned;
  }

  get ndaSignedAt(): string | undefined {
    return this._ndaSignedAt;
  }

  get onboardingStatus(): OnboardingStatus {
    return this._onboardingStatus;
  }

  get tier(): BetaCustomerTier | undefined {
    return this._tier;
  }

  get notes(): string | undefined {
    return this._notes;
  }

  get feedbackCount(): number {
    return this._feedbackCount;
  }

  get lastActiveAt(): string | undefined {
    return this._lastActiveAt;
  }

  get createdAt(): string {
    return this._createdAt;
  }

  get updatedAt(): string | undefined {
    return this._updatedAt;
  }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if customer can start onboarding
   */
  get canStartOnboarding(): boolean {
    return this._ndaSigned && this._onboardingStatus === 'pending';
  }

  /**
   * Check if customer is actively onboarding
   */
  get isOnboarding(): boolean {
    return this._onboardingStatus === 'in-progress';
  }

  /**
   * Check if customer has completed onboarding
   */
  get hasCompletedOnboarding(): boolean {
    return this._onboardingStatus === 'completed';
  }

  /**
   * Check if customer has churned
   */
  get hasChurned(): boolean {
    return this._onboardingStatus === 'churned';
  }

  /**
   * Check if customer is a design partner
   */
  get isDesignPartner(): boolean {
    return this._tier === 'design-partner';
  }

  /**
   * Check if customer was active recently (within 30 days)
   */
  get isRecentlyActive(): boolean {
    if (!this._lastActiveAt) return false;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return new Date(this._lastActiveAt).getTime() > thirtyDaysAgo;
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new beta customer with validation
   *
   * @param params - Creation parameters
   * @returns Result containing the entity or validation error
   */
  static create(params: CreateBetaCustomerParams): ValidationResult<BetaCustomerEntity> {
    // Validate company name
    if (!params.companyName || typeof params.companyName !== 'string') {
      return Result.err(ValidationError.required('companyName'));
    }

    const trimmedCompanyName = params.companyName.trim();
    if (trimmedCompanyName.length === 0) {
      return Result.err(
        ValidationError.invalidValue('companyName', params.companyName, 'Company name cannot be empty')
      );
    }

    if (trimmedCompanyName.length > 200) {
      return Result.err(
        ValidationError.outOfRange('companyName', 1, 200)
      );
    }

    // Validate contact email
    if (!params.contactEmail || typeof params.contactEmail !== 'string') {
      return Result.err(ValidationError.required('contactEmail'));
    }

    const trimmedEmail = params.contactEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return Result.err(
        ValidationError.invalidFormat('contactEmail', 'valid email address')
      );
    }

    // Validate tier if provided
    const validTiers: BetaCustomerTier[] = ['design-partner', 'early-adopter', 'beta-tester'];
    if (params.tier && !validTiers.includes(params.tier)) {
      return Result.err(
        ValidationError.invalidValue('tier', params.tier, `Must be one of: ${validTiers.join(', ')}`)
      );
    }

    const now = new Date().toISOString();
    const id = params.id ?? randomUUID();

    return Result.ok(
      new BetaCustomerEntity({
        id,
        companyName: trimmedCompanyName,
        contactEmail: trimmedEmail,
        contactName: params.contactName?.trim(),
        ndaSigned: false,
        onboardingStatus: 'pending',
        tier: params.tier,
        notes: params.notes,
        feedbackCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstitute from persisted data (no validation, trusted source)
   *
   * @param data - Persisted customer data
   * @returns BetaCustomerEntity instance
   */
  static reconstitute(data: BetaCustomerData): BetaCustomerEntity {
    return new BetaCustomerEntity(data);
  }

  // ==========================================================================
  // Domain Behavior Methods
  // ==========================================================================

  /**
   * Update the company name
   *
   * @param companyName - New company name
   */
  updateCompanyName(companyName: string): void {
    const trimmed = companyName.trim();
    if (trimmed.length === 0) {
      throw new DomainError(
        'Company name cannot be empty',
        'INVALID_COMPANY_NAME',
        { companyName }
      );
    }

    if (trimmed.length > 200) {
      throw new DomainError(
        'Company name exceeds maximum length of 200 characters',
        'COMPANY_NAME_TOO_LONG',
        { length: trimmed.length, max: 200 }
      );
    }

    this._companyName = trimmed;
    this._updatedAt = new Date().toISOString();
  }

  /**
   * Update the contact email
   *
   * @param contactEmail - New contact email
   */
  updateContactEmail(contactEmail: string): void {
    const trimmed = contactEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
      throw new DomainError(
        'Invalid email format',
        'INVALID_EMAIL',
        { email: contactEmail }
      );
    }

    this._contactEmail = trimmed;
    this._updatedAt = new Date().toISOString();
  }

  /**
   * Update the contact name
   *
   * @param contactName - New contact name
   */
  updateContactName(contactName: string | undefined): void {
    this._contactName = contactName?.trim() || undefined;
    this._updatedAt = new Date().toISOString();
  }

  /**
   * Set the customer tier
   *
   * @param tier - New tier
   */
  setTier(tier: BetaCustomerTier): void {
    const validTiers: BetaCustomerTier[] = ['design-partner', 'early-adopter', 'beta-tester'];
    if (!validTiers.includes(tier)) {
      throw new DomainError(
        `Invalid tier: ${tier}`,
        'INVALID_TIER',
        { tier, validTiers }
      );
    }

    this._tier = tier;
    this._updatedAt = new Date().toISOString();
  }

  /**
   * Update internal notes
   *
   * @param notes - New notes
   */
  updateNotes(notes: string | undefined): void {
    this._notes = notes?.trim() || undefined;
    this._updatedAt = new Date().toISOString();
  }

  /**
   * Record a feedback submission
   */
  recordFeedback(): void {
    this._feedbackCount++;
    this._lastActiveAt = new Date().toISOString();
    this._updatedAt = this._lastActiveAt;
  }

  /**
   * Record customer activity
   */
  recordActivity(): void {
    const now = new Date().toISOString();
    this._lastActiveAt = now;
    this._updatedAt = now;
  }

  // ==========================================================================
  // NDA Methods
  // ==========================================================================

  /**
   * Record NDA signature
   *
   * @param signedBy - Optional identifier of who recorded the signature
   */
  signNDA(signedBy?: string): void {
    if (this._ndaSigned) {
      throw new DomainError(
        'NDA already signed',
        'NDA_ALREADY_SIGNED',
        { customerId: this.id, signedAt: this._ndaSignedAt }
      );
    }

    const now = new Date().toISOString();
    this._ndaSigned = true;
    this._ndaSignedAt = now;
    this._updatedAt = now;

    // Optionally record who processed the NDA
    if (signedBy) {
      this._notes = this._notes
        ? `${this._notes}\n[${now}] NDA processed by: ${signedBy}`
        : `[${now}] NDA processed by: ${signedBy}`;
    }
  }

  /**
   * Revoke NDA (for special cases only)
   *
   * @param reason - Reason for revocation
   */
  revokeNDA(reason: string): void {
    if (!this._ndaSigned) {
      throw new DomainError(
        'No NDA to revoke',
        'NDA_NOT_SIGNED',
        { customerId: this.id }
      );
    }

    if (this._onboardingStatus !== 'pending') {
      throw new DomainError(
        'Cannot revoke NDA after onboarding has started',
        'ONBOARDING_STARTED',
        { customerId: this.id, status: this._onboardingStatus }
      );
    }

    const now = new Date().toISOString();
    this._ndaSigned = false;
    this._ndaSignedAt = undefined;
    this._updatedAt = now;
    this._notes = this._notes
      ? `${this._notes}\n[${now}] NDA revoked: ${reason}`
      : `[${now}] NDA revoked: ${reason}`;
  }

  // ==========================================================================
  // Onboarding Status Methods
  // ==========================================================================

  /**
   * Start the onboarding process
   */
  startOnboarding(): void {
    if (!this._ndaSigned) {
      throw new DomainError(
        'NDA must be signed before starting onboarding',
        'NDA_REQUIRED',
        { customerId: this.id }
      );
    }

    if (this._onboardingStatus !== 'pending') {
      throw new DomainError(
        'Onboarding has already started or completed',
        'INVALID_ONBOARDING_TRANSITION',
        { currentStatus: this._onboardingStatus, targetStatus: 'in-progress' }
      );
    }

    this._onboardingStatus = 'in-progress';
    this._lastActiveAt = new Date().toISOString();
    this._updatedAt = this._lastActiveAt;
  }

  /**
   * Complete the onboarding process
   */
  completeOnboarding(): void {
    if (this._onboardingStatus !== 'in-progress') {
      throw new DomainError(
        'Onboarding must be in progress to complete',
        'INVALID_ONBOARDING_TRANSITION',
        { currentStatus: this._onboardingStatus, targetStatus: 'completed' }
      );
    }

    this._onboardingStatus = 'completed';
    this._lastActiveAt = new Date().toISOString();
    this._updatedAt = this._lastActiveAt;
  }

  /**
   * Advance onboarding to next status (convenience method)
   */
  advanceOnboarding(): void {
    if (this._onboardingStatus === 'pending') {
      this.startOnboarding();
    } else if (this._onboardingStatus === 'in-progress') {
      this.completeOnboarding();
    } else {
      throw new DomainError(
        'Cannot advance onboarding from current status',
        'INVALID_ONBOARDING_TRANSITION',
        { currentStatus: this._onboardingStatus }
      );
    }
  }

  /**
   * Mark customer as churned
   *
   * @param reason - Reason for churn
   */
  markAsChurned(reason: string): void {
    if (this._onboardingStatus === 'churned') {
      return; // Already churned, no-op
    }

    const now = new Date().toISOString();
    this._onboardingStatus = 'churned';
    this._updatedAt = now;
    this._notes = this._notes
      ? `${this._notes}\n[${now}] Churned: ${reason}`
      : `[${now}] Churned: ${reason}`;
  }

  /**
   * Reactivate a churned customer
   *
   * @param restoreStatus - Status to restore to (default: in-progress if NDA signed, pending otherwise)
   */
  reactivate(restoreStatus?: OnboardingStatus): void {
    if (this._onboardingStatus !== 'churned') {
      throw new DomainError(
        'Only churned customers can be reactivated',
        'NOT_CHURNED',
        { currentStatus: this._onboardingStatus }
      );
    }

    const now = new Date().toISOString();

    // Determine target status
    if (restoreStatus) {
      if (restoreStatus === 'churned') {
        throw new DomainError(
          'Cannot reactivate to churned status',
          'INVALID_REACTIVATION_STATUS',
          { targetStatus: restoreStatus }
        );
      }
      // Validate the transition is valid given NDA status
      if (restoreStatus !== 'pending' && !this._ndaSigned) {
        throw new DomainError(
          'Cannot restore to active onboarding without signed NDA',
          'NDA_REQUIRED',
          { targetStatus: restoreStatus }
        );
      }
      this._onboardingStatus = restoreStatus;
    } else {
      // Auto-determine based on NDA status
      this._onboardingStatus = this._ndaSigned ? 'in-progress' : 'pending';
    }

    this._lastActiveAt = now;
    this._updatedAt = now;
    this._notes = this._notes
      ? `${this._notes}\n[${now}] Reactivated to: ${this._onboardingStatus}`
      : `[${now}] Reactivated to: ${this._onboardingStatus}`;
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object for serialization
   *
   * @returns Plain object representation matching BetaCustomer type
   */
  toJSON(): BetaCustomerType {
    return {
      id: this.id,
      companyName: this._companyName,
      contactEmail: this._contactEmail,
      contactName: this._contactName,
      ndaSigned: this._ndaSigned,
      ndaSignedAt: this._ndaSignedAt,
      onboardingStatus: this._onboardingStatus,
      tier: this._tier,
      notes: this._notes,
      feedbackCount: this._feedbackCount,
      lastActiveAt: this._lastActiveAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Convert to summary object for listings
   *
   * @returns Summary representation
   */
  toSummary(): BetaCustomerSummary {
    return {
      id: this.id,
      companyName: this._companyName,
      contactEmail: this._contactEmail,
      ndaSigned: this._ndaSigned,
      onboardingStatus: this._onboardingStatus,
      tier: this._tier,
      createdAt: this._createdAt,
    };
  }

  /**
   * Check equality with another customer (by ID)
   *
   * @param other - Other customer to compare
   * @returns True if same customer (same ID)
   */
  equals(other: BetaCustomerEntity): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return this.id === other.id;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `BetaCustomer(${this.id}, "${this._companyName}", ${this._onboardingStatus})`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a beta customer from creation parameters
 *
 * @param params - Creation parameters
 * @returns Result containing BetaCustomerEntity or validation error
 */
export function createBetaCustomer(params: CreateBetaCustomerParams): ValidationResult<BetaCustomerEntity> {
  return BetaCustomerEntity.create(params);
}

/**
 * Reconstitute a beta customer from persisted data
 *
 * @param data - Persisted customer data
 * @returns BetaCustomerEntity instance
 */
export function reconstituteBetaCustomer(data: BetaCustomerData): BetaCustomerEntity {
  return BetaCustomerEntity.reconstitute(data);
}
