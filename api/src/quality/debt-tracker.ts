/**
 * Technical Debt Tracker
 * @module quality/debt-tracker
 *
 * Tracks, categorizes, and prioritizes technical debt items.
 * Provides tools for managing and reducing technical debt over time.
 *
 * Categories follow industry-standard technical debt classification:
 * - Code Smell: Issues with code quality and readability
 * - Design Debt: Architectural or design pattern violations
 * - Test Debt: Missing or inadequate test coverage
 * - Documentation Debt: Missing or outdated documentation
 * - Dependency Debt: Outdated or vulnerable dependencies
 * - Security Debt: Security vulnerabilities or weaknesses
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Categories of technical debt
 */
export type DebtCategory =
  | 'code-smell'
  | 'design-debt'
  | 'test-debt'
  | 'documentation-debt'
  | 'dependency-debt'
  | 'security-debt';

/**
 * Priority levels for debt items
 */
export type DebtPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Status of a debt item
 */
export type DebtStatus =
  | 'open'
  | 'in-progress'
  | 'resolved'
  | 'wont-fix'
  | 'deferred';

/**
 * A single technical debt item
 */
export interface TechnicalDebt {
  /** Unique identifier */
  id: string;
  /** Category of debt */
  category: DebtCategory;
  /** Priority level */
  priority: DebtPriority;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** File path where debt exists */
  filePath: string;
  /** Line number (optional) */
  lineNumber?: number;
  /** Estimated hours to fix */
  estimatedHours: number;
  /** Current status */
  status: DebtStatus;
  /** Tags for filtering */
  tags: string[];
  /** Assignee (optional) */
  assignee?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Resolution timestamp */
  resolvedAt?: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new debt item
 */
export type CreateDebtInput = Omit<
  TechnicalDebt,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'resolvedAt'
>;

/**
 * Summary of technical debt
 */
export interface DebtSummary {
  /** Total number of debt items */
  totalItems: number;
  /** Total estimated hours */
  totalHours: number;
  /** Counts by category */
  byCategory: Record<DebtCategory, { count: number; hours: number }>;
  /** Counts by priority */
  byPriority: Record<DebtPriority, { count: number; hours: number }>;
  /** Counts by status */
  byStatus: Record<DebtStatus, number>;
  /** Files with most debt */
  topFiles: Array<{ path: string; debtCount: number; hours: number }>;
  /** Debt trend (if historical data available) */
  trend?: {
    addedLast30Days: number;
    resolvedLast30Days: number;
    netChange: number;
  };
}

/**
 * Filter options for querying debt
 */
export interface DebtFilter {
  category?: DebtCategory[];
  priority?: DebtPriority[];
  status?: DebtStatus[];
  tags?: string[];
  assignee?: string;
  filePath?: string;
  minHours?: number;
  maxHours?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Sort options for debt queries
 */
export interface DebtSort {
  field: 'priority' | 'estimatedHours' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

// ============================================================================
// Category Metadata
// ============================================================================

/**
 * Metadata for each debt category
 */
export const CATEGORY_INFO: Record<
  DebtCategory,
  { label: string; description: string; defaultPriority: DebtPriority }
> = {
  'code-smell': {
    label: 'Code Smell',
    description: 'Issues with code quality, readability, or maintainability',
    defaultPriority: 'medium',
  },
  'design-debt': {
    label: 'Design Debt',
    description: 'Architectural or design pattern violations',
    defaultPriority: 'high',
  },
  'test-debt': {
    label: 'Test Debt',
    description: 'Missing or inadequate test coverage',
    defaultPriority: 'medium',
  },
  'documentation-debt': {
    label: 'Documentation Debt',
    description: 'Missing or outdated documentation',
    defaultPriority: 'low',
  },
  'dependency-debt': {
    label: 'Dependency Debt',
    description: 'Outdated, deprecated, or vulnerable dependencies',
    defaultPriority: 'high',
  },
  'security-debt': {
    label: 'Security Debt',
    description: 'Security vulnerabilities or weaknesses',
    defaultPriority: 'critical',
  },
} as const;

/**
 * Priority weight for sorting
 */
const PRIORITY_WEIGHT: Record<DebtPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

// ============================================================================
// Technical Debt Tracker Implementation
// ============================================================================

/**
 * Tracks and manages technical debt
 */
export class TechnicalDebtTracker {
  private debts: Map<string, TechnicalDebt> = new Map();
  private idCounter: number = 0;

  /**
   * Add a new debt item
   */
  addDebt(input: CreateDebtInput): TechnicalDebt {
    const id = this.generateId();
    const now = new Date();

    const debt: TechnicalDebt = {
      ...input,
      id,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    this.debts.set(id, debt);
    return debt;
  }

  /**
   * Add multiple debt items at once
   */
  addDebtBatch(inputs: CreateDebtInput[]): TechnicalDebt[] {
    return inputs.map(input => this.addDebt(input));
  }

  /**
   * Update an existing debt item
   */
  updateDebt(
    id: string,
    updates: Partial<Omit<TechnicalDebt, 'id' | 'createdAt'>>
  ): TechnicalDebt | null {
    const debt = this.debts.get(id);
    if (!debt) return null;

    const updated: TechnicalDebt = {
      ...debt,
      ...updates,
      updatedAt: new Date(),
    };

    // Track resolution
    if (updates.status === 'resolved' && debt.status !== 'resolved') {
      updated.resolvedAt = new Date();
    }

    this.debts.set(id, updated);
    return updated;
  }

  /**
   * Remove a debt item
   */
  removeDebt(id: string): boolean {
    return this.debts.delete(id);
  }

  /**
   * Get a debt item by ID
   */
  getDebt(id: string): TechnicalDebt | null {
    return this.debts.get(id) ?? null;
  }

  /**
   * Get all debt items matching a filter
   */
  getDebts(filter?: DebtFilter, sort?: DebtSort): TechnicalDebt[] {
    let results = Array.from(this.debts.values());

    // Apply filters
    if (filter) {
      results = results.filter(debt => this.matchesFilter(debt, filter));
    }

    // Apply sorting
    if (sort) {
      results = this.sortDebts(results, sort);
    } else {
      // Default sort: by priority (desc), then by estimated hours (asc for quick wins)
      results = this.sortByPriority(results);
    }

    return results;
  }

  /**
   * Get debt summary statistics
   */
  getSummary(): DebtSummary {
    const allDebts = Array.from(this.debts.values());
    const openDebts = allDebts.filter(d => d.status === 'open' || d.status === 'in-progress');

    // Initialize counters
    const byCategory: DebtSummary['byCategory'] = {
      'code-smell': { count: 0, hours: 0 },
      'design-debt': { count: 0, hours: 0 },
      'test-debt': { count: 0, hours: 0 },
      'documentation-debt': { count: 0, hours: 0 },
      'dependency-debt': { count: 0, hours: 0 },
      'security-debt': { count: 0, hours: 0 },
    };

    const byPriority: DebtSummary['byPriority'] = {
      critical: { count: 0, hours: 0 },
      high: { count: 0, hours: 0 },
      medium: { count: 0, hours: 0 },
      low: { count: 0, hours: 0 },
    };

    const byStatus: DebtSummary['byStatus'] = {
      'open': 0,
      'in-progress': 0,
      'resolved': 0,
      'wont-fix': 0,
      'deferred': 0,
    };

    const fileMap = new Map<string, { count: number; hours: number }>();
    let totalHours = 0;

    // Calculate statistics
    for (const debt of allDebts) {
      // By category (only count open debt for hours)
      byCategory[debt.category].count++;
      if (debt.status === 'open' || debt.status === 'in-progress') {
        byCategory[debt.category].hours += debt.estimatedHours;
        totalHours += debt.estimatedHours;
      }

      // By priority
      byPriority[debt.priority].count++;
      if (debt.status === 'open' || debt.status === 'in-progress') {
        byPriority[debt.priority].hours += debt.estimatedHours;
      }

      // By status
      byStatus[debt.status]++;

      // By file
      const fileStats = fileMap.get(debt.filePath) ?? { count: 0, hours: 0 };
      fileStats.count++;
      if (debt.status === 'open' || debt.status === 'in-progress') {
        fileStats.hours += debt.estimatedHours;
      }
      fileMap.set(debt.filePath, fileStats);
    }

    // Top files
    const topFiles = Array.from(fileMap.entries())
      .map(([path, stats]) => ({ path, debtCount: stats.count, hours: stats.hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);

    // Calculate trend
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const addedLast30Days = allDebts.filter(d => d.createdAt >= thirtyDaysAgo).length;
    const resolvedLast30Days = allDebts.filter(
      d => d.resolvedAt && d.resolvedAt >= thirtyDaysAgo
    ).length;

    return {
      totalItems: openDebts.length,
      totalHours,
      byCategory,
      byPriority,
      byStatus,
      topFiles,
      trend: {
        addedLast30Days,
        resolvedLast30Days,
        netChange: addedLast30Days - resolvedLast30Days,
      },
    };
  }

  /**
   * Get prioritized list of debt to tackle
   * Returns debt sorted by impact (priority * 1/hours for quick wins)
   */
  getPrioritizedList(limit: number = 20): TechnicalDebt[] {
    const openDebts = Array.from(this.debts.values()).filter(
      d => d.status === 'open' || d.status === 'in-progress'
    );

    return openDebts
      .map(debt => ({
        debt,
        score: this.calculateImpactScore(debt),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.debt);
  }

  /**
   * Get quick wins (high priority, low effort)
   */
  getQuickWins(maxHours: number = 2, limit: number = 10): TechnicalDebt[] {
    const openDebts = Array.from(this.debts.values()).filter(
      d =>
        (d.status === 'open' || d.status === 'in-progress') &&
        d.estimatedHours <= maxHours &&
        (d.priority === 'critical' || d.priority === 'high')
    );

    return this.sortByPriority(openDebts).slice(0, limit);
  }

  /**
   * Get debt by category
   */
  getByCategory(category: DebtCategory): TechnicalDebt[] {
    return this.getDebts({ category: [category] });
  }

  /**
   * Get debt by file
   */
  getByFile(filePath: string): TechnicalDebt[] {
    return this.getDebts({ filePath });
  }

  /**
   * Resolve a debt item
   */
  resolveDebt(id: string): TechnicalDebt | null {
    return this.updateDebt(id, { status: 'resolved' });
  }

  /**
   * Defer a debt item
   */
  deferDebt(id: string, reason?: string): TechnicalDebt | null {
    return this.updateDebt(id, {
      status: 'deferred',
      metadata: { deferredReason: reason },
    });
  }

  /**
   * Export debt data to JSON
   */
  exportToJson(): string {
    const data = {
      debts: Array.from(this.debts.values()),
      summary: this.getSummary(),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import debt data from JSON
   */
  importFromJson(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(json);

      if (!Array.isArray(data.debts)) {
        throw new Error('Invalid format: missing debts array');
      }

      for (const debtData of data.debts) {
        try {
          const debt: TechnicalDebt = {
            ...debtData,
            createdAt: new Date(debtData.createdAt),
            updatedAt: new Date(debtData.updatedAt),
            resolvedAt: debtData.resolvedAt ? new Date(debtData.resolvedAt) : undefined,
          };

          this.debts.set(debt.id, debt);
          imported++;

          // Update ID counter if needed
          const idNum = parseInt(debt.id.replace(/\D/g, ''), 10);
          if (!isNaN(idNum) && idNum >= this.idCounter) {
            this.idCounter = idNum + 1;
          }
        } catch (err) {
          errors.push(`Failed to import debt ${debtData.id}: ${err}`);
        }
      }
    } catch (err) {
      errors.push(`Failed to parse JSON: ${err}`);
    }

    return { imported, errors };
  }

  /**
   * Clear all debt items
   */
  clear(): void {
    this.debts.clear();
    this.idCounter = 0;
  }

  /**
   * Get statistics for a specific time range
   */
  getStatsForPeriod(startDate: Date, endDate: Date): {
    added: number;
    resolved: number;
    hoursAdded: number;
    hoursResolved: number;
  } {
    const allDebts = Array.from(this.debts.values());

    const added = allDebts.filter(
      d => d.createdAt >= startDate && d.createdAt <= endDate
    );

    const resolved = allDebts.filter(
      d => d.resolvedAt && d.resolvedAt >= startDate && d.resolvedAt <= endDate
    );

    return {
      added: added.length,
      resolved: resolved.length,
      hoursAdded: added.reduce((sum, d) => sum + d.estimatedHours, 0),
      hoursResolved: resolved.reduce((sum, d) => sum + d.estimatedHours, 0),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    this.idCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.idCounter.toString(36).padStart(4, '0');
    return `DEBT-${timestamp}-${counter}`;
  }

  /**
   * Check if debt matches filter
   */
  private matchesFilter(debt: TechnicalDebt, filter: DebtFilter): boolean {
    if (filter.category && !filter.category.includes(debt.category)) {
      return false;
    }

    if (filter.priority && !filter.priority.includes(debt.priority)) {
      return false;
    }

    if (filter.status && !filter.status.includes(debt.status)) {
      return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some(tag => debt.tags.includes(tag));
      if (!hasTag) return false;
    }

    if (filter.assignee && debt.assignee !== filter.assignee) {
      return false;
    }

    if (filter.filePath && !debt.filePath.includes(filter.filePath)) {
      return false;
    }

    if (filter.minHours !== undefined && debt.estimatedHours < filter.minHours) {
      return false;
    }

    if (filter.maxHours !== undefined && debt.estimatedHours > filter.maxHours) {
      return false;
    }

    if (filter.createdAfter && debt.createdAt < filter.createdAfter) {
      return false;
    }

    if (filter.createdBefore && debt.createdAt > filter.createdBefore) {
      return false;
    }

    return true;
  }

  /**
   * Sort debts by specified criteria
   */
  private sortDebts(debts: TechnicalDebt[], sort: DebtSort): TechnicalDebt[] {
    return [...debts].sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'priority':
          comparison = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
          break;
        case 'estimatedHours':
          comparison = a.estimatedHours - b.estimatedHours;
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }

      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Sort debts by priority (default sorting)
   */
  private sortByPriority(debts: TechnicalDebt[]): TechnicalDebt[] {
    return [...debts].sort((a, b) => {
      // First by priority
      const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by estimated hours (smaller first for quick wins)
      return a.estimatedHours - b.estimatedHours;
    });
  }

  /**
   * Calculate impact score for prioritization
   * Higher score = should tackle first
   */
  private calculateImpactScore(debt: TechnicalDebt): number {
    const priorityWeight = PRIORITY_WEIGHT[debt.priority];

    // Factor in hours (prefer quick wins)
    const hoursMultiplier = 1 / Math.max(1, debt.estimatedHours);

    // Security and design debt get a boost
    const categoryBoost =
      debt.category === 'security-debt' ? 1.5 :
      debt.category === 'design-debt' ? 1.2 : 1.0;

    return priorityWeight * hoursMultiplier * categoryBoost * 10;
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

/**
 * Default debt tracker instance
 */
export const debtTracker = new TechnicalDebtTracker();

/**
 * Create a new debt tracker
 */
export function createDebtTracker(): TechnicalDebtTracker {
  return new TechnicalDebtTracker();
}

export default TechnicalDebtTracker;
