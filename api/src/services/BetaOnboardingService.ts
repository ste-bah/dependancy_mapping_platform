/**
 * Beta Onboarding Service
 * @module services/BetaOnboardingService
 *
 * Domain service for managing beta customer onboarding. Orchestrates customer
 * registration, NDA tracking, onboarding progression, and customer lifecycle.
 *
 * TASK-FINAL-004: Beta customer management service implementation
 */

import pino from 'pino';
import {
  BetaCustomerEntity,
  createBetaCustomer,
  reconstituteBetaCustomer,
  Result,
  ValidationError,
  DomainError,
  type CreateBetaCustomerParams,
  type BetaCustomerData,
} from '../domain/documentation/index.js';
import type {
  BetaCustomer,
  BetaCustomerSummary,
  OnboardingStatus,
  BetaCustomerTier,
  BetaCustomerStats,
} from '../types/documentation.js';

const logger = pino({ name: 'beta-onboarding-service' });

// ============================================================================
// Types
// ============================================================================

/**
 * DTO for registering a beta customer
 */
export interface RegisterBetaCustomerDTO {
  readonly companyName: string;
  readonly contactEmail: string;
  readonly contactName?: string;
  readonly tier?: BetaCustomerTier;
  readonly notes?: string;
}

/**
 * DTO for updating a beta customer
 */
export interface UpdateBetaCustomerDTO {
  readonly companyName?: string;
  readonly contactEmail?: string;
  readonly contactName?: string;
  readonly tier?: BetaCustomerTier;
  readonly notes?: string;
}

/**
 * Filter options for listing customers
 */
export interface ListCustomersFilter {
  readonly status?: OnboardingStatus;
  readonly tier?: BetaCustomerTier;
  readonly ndaSigned?: boolean;
  readonly search?: string;
  readonly activeInLast30Days?: boolean;
}

/**
 * Sort options for listing customers
 */
export interface ListCustomersSort {
  readonly field: 'companyName' | 'createdAt' | 'lastActiveAt' | 'feedbackCount';
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

/**
 * NDA signature details
 */
export interface NDASignatureInfo {
  readonly customerId: string;
  readonly signedAt: string;
  readonly processedBy?: string;
}

/**
 * Onboarding progress event
 */
export interface OnboardingProgressEvent {
  readonly customerId: string;
  readonly previousStatus: OnboardingStatus;
  readonly newStatus: OnboardingStatus;
  readonly timestamp: string;
}

// ============================================================================
// Beta Onboarding Service Interface
// ============================================================================

/**
 * Beta onboarding service interface
 */
export interface IBetaOnboardingService {
  /**
   * Register a new beta customer
   */
  registerCustomer(dto: RegisterBetaCustomerDTO): Promise<ServiceResult<BetaCustomer>>;

  /**
   * Update beta customer details
   */
  updateCustomer(id: string, dto: UpdateBetaCustomerDTO): Promise<ServiceResult<BetaCustomer>>;

  /**
   * Get a beta customer by ID
   */
  getCustomer(id: string): Promise<BetaCustomer | null>;

  /**
   * Get a beta customer by email
   */
  getCustomerByEmail(email: string): Promise<BetaCustomer | null>;

  /**
   * List beta customers with filtering
   */
  listCustomers(
    filter?: ListCustomersFilter,
    sort?: ListCustomersSort,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<BetaCustomerSummary>>;

  /**
   * Record NDA signature for a customer
   */
  signNDA(customerId: string, processedBy?: string): Promise<ServiceResult<NDASignatureInfo>>;

  /**
   * Revoke NDA (special cases only)
   */
  revokeNDA(customerId: string, reason: string): Promise<ServiceResult<BetaCustomer>>;

  /**
   * Start customer onboarding
   */
  startOnboarding(customerId: string): Promise<ServiceResult<OnboardingProgressEvent>>;

  /**
   * Complete customer onboarding
   */
  completeOnboarding(customerId: string): Promise<ServiceResult<OnboardingProgressEvent>>;

  /**
   * Mark customer as churned
   */
  markAsChurned(customerId: string, reason: string): Promise<ServiceResult<BetaCustomer>>;

  /**
   * Reactivate a churned customer
   */
  reactivateCustomer(customerId: string): Promise<ServiceResult<OnboardingProgressEvent>>;

  /**
   * Record customer feedback
   */
  recordFeedback(customerId: string): Promise<ServiceResult<BetaCustomer>>;

  /**
   * Record customer activity
   */
  recordActivity(customerId: string): Promise<ServiceResult<BetaCustomer>>;

  /**
   * Delete a beta customer
   */
  deleteCustomer(id: string): Promise<boolean>;

  /**
   * Get beta customer statistics
   */
  getStatistics(): Promise<BetaCustomerStats>;
}

// ============================================================================
// Beta Onboarding Service Implementation
// ============================================================================

/**
 * Beta Onboarding Service Implementation
 *
 * Manages beta customer lifecycle with in-memory storage (MVP).
 * Will be replaced with repository injection for production.
 */
export class BetaOnboardingService implements IBetaOnboardingService {
  /**
   * In-memory store for beta customers (MVP - to be replaced with repository)
   */
  private customers: Map<string, BetaCustomerEntity> = new Map();

  /**
   * Email to ID index for fast lookup
   */
  private emailIndex: Map<string, string> = new Map();

  // ==========================================================================
  // Constructor
  // ==========================================================================

  constructor() {
    logger.info('BetaOnboardingService initialized');
  }

  // ==========================================================================
  // Create Operations
  // ==========================================================================

  /**
   * Register a new beta customer
   */
  async registerCustomer(dto: RegisterBetaCustomerDTO): Promise<ServiceResult<BetaCustomer>> {
    logger.info({ dto: { companyName: dto.companyName, email: dto.contactEmail } }, 'Registering beta customer');

    try {
      // Check for duplicate email
      const normalizedEmail = dto.contactEmail.trim().toLowerCase();
      if (this.emailIndex.has(normalizedEmail)) {
        return Result.err({
          code: 'DUPLICATE_EMAIL',
          message: `A customer with email "${normalizedEmail}" already exists`,
          context: { email: normalizedEmail },
        });
      }

      // Create customer via domain factory
      const createParams: CreateBetaCustomerParams = {
        companyName: dto.companyName,
        contactEmail: dto.contactEmail,
        contactName: dto.contactName,
        tier: dto.tier,
        notes: dto.notes,
      };

      const result = createBetaCustomer(createParams);

      if (Result.isErr(result)) {
        const error = result.error;
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      const customer = result.value;

      // Store customer
      this.customers.set(customer.id, customer);
      this.emailIndex.set(customer.contactEmail, customer.id);

      logger.info({ customerId: customer.id, companyName: customer.companyName }, 'Beta customer registered');
      return Result.ok(customer.toJSON());
    } catch (error) {
      logger.error({ error }, 'Failed to register beta customer');
      return Result.err({
        code: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to register customer',
      });
    }
  }

  // ==========================================================================
  // Update Operations
  // ==========================================================================

  /**
   * Update beta customer details
   */
  async updateCustomer(id: string, dto: UpdateBetaCustomerDTO): Promise<ServiceResult<BetaCustomer>> {
    logger.info({ customerId: id, updates: Object.keys(dto) }, 'Updating beta customer');

    try {
      const customer = this.customers.get(id);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${id} not found`,
          context: { customerId: id },
        });
      }

      // Check for email conflict if changing email
      if (dto.contactEmail !== undefined) {
        const normalizedEmail = dto.contactEmail.trim().toLowerCase();
        const existingId = this.emailIndex.get(normalizedEmail);
        if (existingId && existingId !== id) {
          return Result.err({
            code: 'DUPLICATE_EMAIL',
            message: `Email "${normalizedEmail}" is already in use`,
            context: { email: normalizedEmail },
          });
        }
      }

      // Apply updates
      if (dto.companyName !== undefined) {
        customer.updateCompanyName(dto.companyName);
      }

      if (dto.contactEmail !== undefined) {
        // Update email index
        this.emailIndex.delete(customer.contactEmail);
        customer.updateContactEmail(dto.contactEmail);
        this.emailIndex.set(customer.contactEmail, id);
      }

      if (dto.contactName !== undefined) {
        customer.updateContactName(dto.contactName);
      }

      if (dto.tier !== undefined) {
        customer.setTier(dto.tier);
      }

      if (dto.notes !== undefined) {
        customer.updateNotes(dto.notes);
      }

      logger.info({ customerId: id }, 'Beta customer updated');
      return Result.ok(customer.toJSON());
    } catch (error) {
      logger.error({ error, customerId: id }, 'Failed to update beta customer');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update customer',
      });
    }
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  /**
   * Get a beta customer by ID
   */
  async getCustomer(id: string): Promise<BetaCustomer | null> {
    logger.debug({ customerId: id }, 'Getting beta customer');
    const customer = this.customers.get(id);
    return customer ? customer.toJSON() : null;
  }

  /**
   * Get a beta customer by email
   */
  async getCustomerByEmail(email: string): Promise<BetaCustomer | null> {
    logger.debug({ email }, 'Getting beta customer by email');
    const normalizedEmail = email.trim().toLowerCase();
    const id = this.emailIndex.get(normalizedEmail);
    if (!id) return null;
    const customer = this.customers.get(id);
    return customer ? customer.toJSON() : null;
  }

  /**
   * List beta customers with filtering
   */
  async listCustomers(
    filter?: ListCustomersFilter,
    sort?: ListCustomersSort,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<BetaCustomerSummary>> {
    logger.debug({ filter, sort, pagination }, 'Listing beta customers');

    let customers = Array.from(this.customers.values());

    // Apply filters
    if (filter) {
      if (filter.status) {
        customers = customers.filter(c => c.onboardingStatus === filter.status);
      }

      if (filter.tier) {
        customers = customers.filter(c => c.tier === filter.tier);
      }

      if (filter.ndaSigned !== undefined) {
        customers = customers.filter(c => c.ndaSigned === filter.ndaSigned);
      }

      if (filter.activeInLast30Days) {
        customers = customers.filter(c => c.isRecentlyActive);
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        customers = customers.filter(c =>
          c.companyName.toLowerCase().includes(searchLower) ||
          c.contactEmail.toLowerCase().includes(searchLower) ||
          (c.contactName?.toLowerCase().includes(searchLower) ?? false)
        );
      }
    }

    // Apply sorting
    const sortField = sort?.field ?? 'createdAt';
    const sortDir = sort?.direction ?? 'desc';

    customers.sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      switch (sortField) {
        case 'companyName':
          aVal = a.companyName;
          bVal = b.companyName;
          break;
        case 'lastActiveAt':
          aVal = a.lastActiveAt;
          bVal = b.lastActiveAt;
          break;
        case 'feedbackCount':
          aVal = a.feedbackCount;
          bVal = b.feedbackCount;
          break;
        case 'createdAt':
        default:
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
      }

      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return sortDir === 'asc' ? 1 : -1;
      if (bVal === undefined) return sortDir === 'asc' ? -1 : 1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const total = customers.length;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const totalPages = Math.ceil(total / pageSize);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pagedData = customers.slice(start, end);

    return {
      data: pagedData.map(c => c.toSummary()),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // ==========================================================================
  // NDA Operations
  // ==========================================================================

  /**
   * Record NDA signature for a customer
   */
  async signNDA(customerId: string, processedBy?: string): Promise<ServiceResult<NDASignatureInfo>> {
    logger.info({ customerId, processedBy }, 'Recording NDA signature');

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${customerId} not found`,
          context: { customerId },
        });
      }

      customer.signNDA(processedBy);

      logger.info({ customerId }, 'NDA signature recorded');
      return Result.ok({
        customerId,
        signedAt: customer.ndaSignedAt!,
        processedBy,
      });
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to record NDA signature');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'NDA_SIGN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to sign NDA',
      });
    }
  }

  /**
   * Revoke NDA (special cases only)
   */
  async revokeNDA(customerId: string, reason: string): Promise<ServiceResult<BetaCustomer>> {
    logger.info({ customerId, reason }, 'Revoking NDA');

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${customerId} not found`,
          context: { customerId },
        });
      }

      customer.revokeNDA(reason);

      logger.info({ customerId }, 'NDA revoked');
      return Result.ok(customer.toJSON());
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to revoke NDA');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'NDA_REVOKE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to revoke NDA',
      });
    }
  }

  // ==========================================================================
  // Onboarding Status Operations
  // ==========================================================================

  /**
   * Start customer onboarding
   */
  async startOnboarding(customerId: string): Promise<ServiceResult<OnboardingProgressEvent>> {
    logger.info({ customerId }, 'Starting onboarding');

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${customerId} not found`,
          context: { customerId },
        });
      }

      const previousStatus = customer.onboardingStatus;
      customer.startOnboarding();

      logger.info({ customerId }, 'Onboarding started');
      return Result.ok({
        customerId,
        previousStatus,
        newStatus: customer.onboardingStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to start onboarding');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'ONBOARDING_START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start onboarding',
      });
    }
  }

  /**
   * Complete customer onboarding
   */
  async completeOnboarding(customerId: string): Promise<ServiceResult<OnboardingProgressEvent>> {
    logger.info({ customerId }, 'Completing onboarding');

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${customerId} not found`,
          context: { customerId },
        });
      }

      const previousStatus = customer.onboardingStatus;
      customer.completeOnboarding();

      logger.info({ customerId }, 'Onboarding completed');
      return Result.ok({
        customerId,
        previousStatus,
        newStatus: customer.onboardingStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to complete onboarding');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'ONBOARDING_COMPLETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to complete onboarding',
      });
    }
  }

  /**
   * Mark customer as churned
   */
  async markAsChurned(customerId: string, reason: string): Promise<ServiceResult<BetaCustomer>> {
    logger.info({ customerId, reason }, 'Marking customer as churned');

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${customerId} not found`,
          context: { customerId },
        });
      }

      customer.markAsChurned(reason);

      logger.info({ customerId }, 'Customer marked as churned');
      return Result.ok(customer.toJSON());
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to mark customer as churned');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'CHURN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to mark as churned',
      });
    }
  }

  /**
   * Reactivate a churned customer
   */
  async reactivateCustomer(customerId: string): Promise<ServiceResult<OnboardingProgressEvent>> {
    logger.info({ customerId }, 'Reactivating customer');

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${customerId} not found`,
          context: { customerId },
        });
      }

      const previousStatus = customer.onboardingStatus;
      customer.reactivate();

      logger.info({ customerId }, 'Customer reactivated');
      return Result.ok({
        customerId,
        previousStatus,
        newStatus: customer.onboardingStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to reactivate customer');

      if (error instanceof DomainError) {
        return Result.err({
          code: error.code,
          message: error.message,
          context: error.context,
        });
      }

      return Result.err({
        code: 'REACTIVATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to reactivate customer',
      });
    }
  }

  // ==========================================================================
  // Activity Operations
  // ==========================================================================

  /**
   * Record customer feedback
   */
  async recordFeedback(customerId: string): Promise<ServiceResult<BetaCustomer>> {
    logger.info({ customerId }, 'Recording feedback');

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${customerId} not found`,
          context: { customerId },
        });
      }

      customer.recordFeedback();

      logger.info({ customerId, feedbackCount: customer.feedbackCount }, 'Feedback recorded');
      return Result.ok(customer.toJSON());
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to record feedback');

      return Result.err({
        code: 'FEEDBACK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to record feedback',
      });
    }
  }

  /**
   * Record customer activity
   */
  async recordActivity(customerId: string): Promise<ServiceResult<BetaCustomer>> {
    logger.debug({ customerId }, 'Recording activity');

    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        return Result.err({
          code: 'NOT_FOUND',
          message: `Customer ${customerId} not found`,
          context: { customerId },
        });
      }

      customer.recordActivity();

      return Result.ok(customer.toJSON());
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to record activity');

      return Result.err({
        code: 'ACTIVITY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to record activity',
      });
    }
  }

  // ==========================================================================
  // Delete Operations
  // ==========================================================================

  /**
   * Delete a beta customer
   */
  async deleteCustomer(id: string): Promise<boolean> {
    logger.info({ customerId: id }, 'Deleting beta customer');

    const customer = this.customers.get(id);
    if (!customer) {
      return false;
    }

    // Remove from indexes
    this.emailIndex.delete(customer.contactEmail);
    this.customers.delete(id);

    logger.info({ customerId: id }, 'Beta customer deleted');
    return true;
  }

  // ==========================================================================
  // Statistics Operations
  // ==========================================================================

  /**
   * Get beta customer statistics
   */
  async getStatistics(): Promise<BetaCustomerStats> {
    logger.debug('Calculating beta customer statistics');

    const customers = Array.from(this.customers.values());
    const total = customers.length;

    // Count by status
    const byStatus = {
      pending: 0,
      inProgress: 0,
      completed: 0,
      churned: 0,
    };

    // Count by tier
    const byTier = {
      designPartner: 0,
      earlyAdopter: 0,
      betaTester: 0,
    };

    let ndaSignedCount = 0;
    let activeInLast30Days = 0;
    let totalFeedbackCount = 0;

    for (const customer of customers) {
      // Status counts
      switch (customer.onboardingStatus) {
        case 'pending':
          byStatus.pending++;
          break;
        case 'in-progress':
          byStatus.inProgress++;
          break;
        case 'completed':
          byStatus.completed++;
          break;
        case 'churned':
          byStatus.churned++;
          break;
      }

      // Tier counts
      switch (customer.tier) {
        case 'design-partner':
          byTier.designPartner++;
          break;
        case 'early-adopter':
          byTier.earlyAdopter++;
          break;
        case 'beta-tester':
          byTier.betaTester++;
          break;
      }

      // NDA count
      if (customer.ndaSigned) {
        ndaSignedCount++;
      }

      // Active count
      if (customer.isRecentlyActive) {
        activeInLast30Days++;
      }

      // Feedback total
      totalFeedbackCount += customer.feedbackCount;
    }

    const averageFeedbackCount = total > 0
      ? Math.round((totalFeedbackCount / total) * 100) / 100
      : 0;

    return {
      total,
      byStatus,
      byTier,
      ndaSignedCount,
      activeInLast30Days,
      averageFeedbackCount,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new BetaOnboardingService instance
 */
export function createBetaOnboardingService(): IBetaOnboardingService {
  return new BetaOnboardingService();
}

// ============================================================================
// Singleton Instance
// ============================================================================

let betaOnboardingServiceInstance: IBetaOnboardingService | null = null;

/**
 * Get the singleton BetaOnboardingService instance
 */
export function getBetaOnboardingService(): IBetaOnboardingService {
  if (!betaOnboardingServiceInstance) {
    betaOnboardingServiceInstance = createBetaOnboardingService();
  }
  return betaOnboardingServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetBetaOnboardingService(): void {
  betaOnboardingServiceInstance = null;
}
