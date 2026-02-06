/**
 * Beta Customer Repository
 * @module repositories/BetaCustomerRepository
 *
 * Repository interface and in-memory implementation for beta customer management.
 * Supports TASK-FINAL-004 beta customer tracking and onboarding.
 *
 * Note: In-memory implementation for MVP. Ready for database migration.
 */

import pino from 'pino';
import {
  BetaCustomer,
  BetaCustomerSummary,
  BetaCustomerStats,
  BetaCustomerTier,
  OnboardingStatus,
  CreateBetaCustomerRequest,
  UpdateBetaCustomerRequest,
  createBetaCustomer,
} from '../types/documentation.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Filter criteria for beta customers
 */
export interface BetaCustomerFilterCriteria {
  readonly onboardingStatus?: OnboardingStatus;
  readonly tier?: BetaCustomerTier;
  readonly ndaSigned?: boolean;
  readonly search?: string;
  readonly activeAfter?: Date;
}

/**
 * Sort options for beta customers
 */
export interface BetaCustomerSortOptions {
  readonly field: 'companyName' | 'createdAt' | 'lastActiveAt' | 'feedbackCount';
  readonly direction: 'asc' | 'desc';
}

/**
 * Pagination parameters
 */
export interface BetaCustomerPaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Paginated result
 */
export interface BetaCustomerPaginatedResult<T> {
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
 * Beta customer repository interface
 */
export interface IBetaCustomerRepository {
  /**
   * Find customer by ID
   */
  findById(id: string): Promise<BetaCustomer | null>;

  /**
   * Find customer by email
   */
  findByEmail(email: string): Promise<BetaCustomer | null>;

  /**
   * Find all customers matching filter
   */
  findAll(filter?: BetaCustomerFilterCriteria): Promise<BetaCustomer[]>;

  /**
   * Find customers with pagination
   */
  findPaginated(
    filter?: BetaCustomerFilterCriteria,
    pagination?: BetaCustomerPaginationParams,
    sort?: BetaCustomerSortOptions
  ): Promise<BetaCustomerPaginatedResult<BetaCustomer>>;

  /**
   * Find customer summaries (lighter weight for listings)
   */
  findSummaries(filter?: BetaCustomerFilterCriteria): Promise<BetaCustomerSummary[]>;

  /**
   * Create a new customer
   */
  create(request: CreateBetaCustomerRequest): Promise<BetaCustomer>;

  /**
   * Update an existing customer
   */
  update(id: string, request: UpdateBetaCustomerRequest): Promise<BetaCustomer | null>;

  /**
   * Delete a customer
   */
  delete(id: string): Promise<boolean>;

  /**
   * Record NDA signature
   */
  recordNdaSignature(id: string): Promise<BetaCustomer | null>;

  /**
   * Update onboarding status
   */
  updateOnboardingStatus(
    id: string,
    status: OnboardingStatus
  ): Promise<BetaCustomer | null>;

  /**
   * Record activity (updates lastActiveAt)
   */
  recordActivity(id: string): Promise<void>;

  /**
   * Increment feedback count
   */
  incrementFeedbackCount(id: string): Promise<void>;

  /**
   * Get statistics
   */
  getStats(): Promise<BetaCustomerStats>;

  /**
   * Check if email exists
   */
  emailExists(email: string, excludeId?: string): Promise<boolean>;

  /**
   * Get customers by tier
   */
  findByTier(tier: BetaCustomerTier): Promise<BetaCustomer[]>;

  /**
   * Get recently active customers
   */
  findRecentlyActive(daysAgo: number): Promise<BetaCustomer[]>;

  /**
   * Clear all customers (for testing)
   */
  clear(): Promise<void>;
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

/**
 * In-memory beta customer repository implementation
 */
export class InMemoryBetaCustomerRepository implements IBetaCustomerRepository {
  private customers: Map<string, BetaCustomer> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> id
  private readonly logger: pino.Logger;

  constructor() {
    this.logger = pino({ name: 'repository:beta-customer' });
  }

  async findById(id: string): Promise<BetaCustomer | null> {
    this.logger.debug({ id }, 'Finding customer by ID');
    return this.customers.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<BetaCustomer | null> {
    this.logger.debug({ email }, 'Finding customer by email');
    const normalizedEmail = email.toLowerCase();
    const id = this.emailIndex.get(normalizedEmail);
    if (!id) return null;
    return this.customers.get(id) ?? null;
  }

  async findAll(filter?: BetaCustomerFilterCriteria): Promise<BetaCustomer[]> {
    this.logger.debug({ filter }, 'Finding all customers');
    let customers = Array.from(this.customers.values());

    if (filter) {
      customers = this.applyFilter(customers, filter);
    }

    return customers;
  }

  async findPaginated(
    filter?: BetaCustomerFilterCriteria,
    pagination?: BetaCustomerPaginationParams,
    sort?: BetaCustomerSortOptions
  ): Promise<BetaCustomerPaginatedResult<BetaCustomer>> {
    let customers = await this.findAll(filter);

    // Apply sorting
    customers = this.applySorting(customers, sort);

    const total = customers.length;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const data = customers.slice(offset, offset + pageSize);
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findSummaries(filter?: BetaCustomerFilterCriteria): Promise<BetaCustomerSummary[]> {
    const customers = await this.findAll(filter);
    return customers.map(customer => ({
      id: customer.id,
      companyName: customer.companyName,
      contactEmail: customer.contactEmail,
      ndaSigned: customer.ndaSigned,
      onboardingStatus: customer.onboardingStatus,
      tier: customer.tier,
      createdAt: customer.createdAt,
    }));
  }

  async create(request: CreateBetaCustomerRequest): Promise<BetaCustomer> {
    this.logger.debug({ companyName: request.companyName }, 'Creating customer');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalizedEmail = request.contactEmail.toLowerCase();

    // Check for duplicate email
    if (this.emailIndex.has(normalizedEmail)) {
      throw new Error(`Customer with email ${request.contactEmail} already exists`);
    }

    const customer: BetaCustomer = {
      id,
      companyName: request.companyName,
      contactEmail: normalizedEmail,
      contactName: request.contactName,
      ndaSigned: false,
      onboardingStatus: OnboardingStatus.PENDING,
      tier: request.tier,
      notes: request.notes,
      feedbackCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.customers.set(id, customer);
    this.emailIndex.set(normalizedEmail, id);

    this.logger.info({ id, companyName: customer.companyName }, 'Customer created');
    return customer;
  }

  async update(id: string, request: UpdateBetaCustomerRequest): Promise<BetaCustomer | null> {
    this.logger.debug({ id }, 'Updating customer');

    const existing = this.customers.get(id);
    if (!existing) {
      this.logger.warn({ id }, 'Customer not found for update');
      return null;
    }

    // Handle email change
    if (request.contactEmail && request.contactEmail.toLowerCase() !== existing.contactEmail) {
      const normalizedNewEmail = request.contactEmail.toLowerCase();
      if (this.emailIndex.has(normalizedNewEmail)) {
        throw new Error(`Customer with email ${request.contactEmail} already exists`);
      }
      this.emailIndex.delete(existing.contactEmail);
      this.emailIndex.set(normalizedNewEmail, id);
    }

    const updated: BetaCustomer = {
      ...existing,
      ...request,
      contactEmail: request.contactEmail?.toLowerCase() ?? existing.contactEmail,
      id, // Ensure ID cannot be changed
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString(),
    };

    this.customers.set(id, updated);
    this.logger.info({ id }, 'Customer updated');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    this.logger.debug({ id }, 'Deleting customer');

    const customer = this.customers.get(id);
    if (!customer) {
      this.logger.warn({ id }, 'Customer not found for deletion');
      return false;
    }

    this.emailIndex.delete(customer.contactEmail);
    this.customers.delete(id);

    this.logger.info({ id }, 'Customer deleted');
    return true;
  }

  async recordNdaSignature(id: string): Promise<BetaCustomer | null> {
    this.logger.debug({ id }, 'Recording NDA signature');

    const customer = this.customers.get(id);
    if (!customer) return null;

    const now = new Date().toISOString();
    const updated: BetaCustomer = {
      ...customer,
      ndaSigned: true,
      ndaSignedAt: now,
      updatedAt: now,
    };

    this.customers.set(id, updated);
    this.logger.info({ id }, 'NDA signature recorded');
    return updated;
  }

  async updateOnboardingStatus(
    id: string,
    status: OnboardingStatus
  ): Promise<BetaCustomer | null> {
    this.logger.debug({ id, status }, 'Updating onboarding status');

    const customer = this.customers.get(id);
    if (!customer) return null;

    const updated: BetaCustomer = {
      ...customer,
      onboardingStatus: status,
      updatedAt: new Date().toISOString(),
    };

    this.customers.set(id, updated);
    this.logger.info({ id, status }, 'Onboarding status updated');
    return updated;
  }

  async recordActivity(id: string): Promise<void> {
    const customer = this.customers.get(id);
    if (!customer) return;

    const updated: BetaCustomer = {
      ...customer,
      lastActiveAt: new Date().toISOString(),
    };

    this.customers.set(id, updated);
  }

  async incrementFeedbackCount(id: string): Promise<void> {
    const customer = this.customers.get(id);
    if (!customer) return;

    const updated: BetaCustomer = {
      ...customer,
      feedbackCount: (customer.feedbackCount ?? 0) + 1,
      lastActiveAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.customers.set(id, updated);
  }

  async getStats(): Promise<BetaCustomerStats> {
    this.logger.debug('Calculating stats');

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
    let totalFeedback = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
      if (customer.tier) {
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
      }

      // NDA count
      if (customer.ndaSigned) {
        ndaSignedCount++;
      }

      // Activity count
      if (customer.lastActiveAt) {
        const lastActive = new Date(customer.lastActiveAt);
        if (lastActive >= thirtyDaysAgo) {
          activeInLast30Days++;
        }
      }

      // Feedback count
      totalFeedback += customer.feedbackCount ?? 0;
    }

    const averageFeedbackCount = total > 0 ? totalFeedback / total : 0;

    return {
      total,
      byStatus,
      byTier,
      ndaSignedCount,
      activeInLast30Days,
      averageFeedbackCount: Math.round(averageFeedbackCount * 100) / 100,
    };
  }

  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();
    const id = this.emailIndex.get(normalizedEmail);
    if (!id) return false;
    if (excludeId && id === excludeId) return false;
    return true;
  }

  async findByTier(tier: BetaCustomerTier): Promise<BetaCustomer[]> {
    return Array.from(this.customers.values()).filter(c => c.tier === tier);
  }

  async findRecentlyActive(daysAgo: number): Promise<BetaCustomer[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    return Array.from(this.customers.values()).filter(customer => {
      if (!customer.lastActiveAt) return false;
      const lastActive = new Date(customer.lastActiveAt);
      return lastActive >= cutoffDate;
    });
  }

  async clear(): Promise<void> {
    this.logger.info('Clearing all customers');
    this.customers.clear();
    this.emailIndex.clear();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private applyFilter(
    customers: BetaCustomer[],
    filter: BetaCustomerFilterCriteria
  ): BetaCustomer[] {
    return customers.filter(customer => {
      if (filter.onboardingStatus && customer.onboardingStatus !== filter.onboardingStatus) {
        return false;
      }

      if (filter.tier && customer.tier !== filter.tier) {
        return false;
      }

      if (filter.ndaSigned !== undefined && customer.ndaSigned !== filter.ndaSigned) {
        return false;
      }

      if (filter.activeAfter && customer.lastActiveAt) {
        const lastActive = new Date(customer.lastActiveAt);
        if (lastActive < filter.activeAfter) {
          return false;
        }
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const nameMatch = customer.companyName.toLowerCase().includes(searchLower);
        const emailMatch = customer.contactEmail.toLowerCase().includes(searchLower);
        const contactMatch = customer.contactName?.toLowerCase().includes(searchLower);
        if (!nameMatch && !emailMatch && !contactMatch) {
          return false;
        }
      }

      return true;
    });
  }

  private applySorting(
    customers: BetaCustomer[],
    sort?: BetaCustomerSortOptions
  ): BetaCustomer[] {
    if (!sort) {
      // Default sort by createdAt desc
      return customers.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const direction = sort.direction === 'asc' ? 1 : -1;

    return customers.sort((a, b) => {
      let valueA: string | number | Date;
      let valueB: string | number | Date;

      switch (sort.field) {
        case 'companyName':
          valueA = a.companyName.toLowerCase();
          valueB = b.companyName.toLowerCase();
          break;
        case 'createdAt':
          valueA = new Date(a.createdAt);
          valueB = new Date(b.createdAt);
          break;
        case 'lastActiveAt':
          valueA = a.lastActiveAt ? new Date(a.lastActiveAt) : new Date(0);
          valueB = b.lastActiveAt ? new Date(b.lastActiveAt) : new Date(0);
          break;
        case 'feedbackCount':
          valueA = a.feedbackCount ?? 0;
          valueB = b.feedbackCount ?? 0;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
      return 0;
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a beta customer repository instance
 */
export function createBetaCustomerRepository(): IBetaCustomerRepository {
  return new InMemoryBetaCustomerRepository();
}
