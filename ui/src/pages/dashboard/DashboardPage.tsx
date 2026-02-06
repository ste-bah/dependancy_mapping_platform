/**
 * Dashboard Page
 * Main dashboard with overview statistics and recent activity
 * @module pages/dashboard/DashboardPage
 */

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore, selectUser, ROUTES } from '@/core';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from '@/shared';
import {
  useDashboardStats,
  useActivityEvents,
} from '@/features/dashboard';

// Import from extracted components
import {
  // Icons
  RepositoryIcon,
  ScanIcon,
  BoltIcon,
  CubeIcon,
  PlusIcon,
  // Utilities
  formatNumber,
  transformActivityEvent,
  // Components
  StatsCard,
  QuickActionCard,
  ActivityItem,
  ActivitySkeleton,
  EmptyState,
  ErrorState,
} from './components';

// ============================================================================
// Dashboard Page Component
// ============================================================================

/**
 * Dashboard page component
 * Shows overview statistics, quick actions, and recent activity
 */
export default function DashboardPage(): JSX.Element {
  const user = useAuthStore(selectUser);

  // Fetch dashboard data using React Query hooks
  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = useDashboardStats();

  const {
    data: activityEvents,
    isLoading: isActivityLoading,
    isError: isActivityError,
    error: activityError,
    refetch: refetchActivity,
  } = useActivityEvents(10);

  // Determine if we have data to show
  const hasData = stats && stats.repos > 0;

  // Transform activity events to display format
  const recentActivity = activityEvents?.map(transformActivityEvent) ?? [];

  const getGreeting = useCallback((): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.name?.split(' ')[0] ?? 'there'}!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s what&apos;s happening with your repositories
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          asChild
        >
          <Link to={ROUTES.REPOSITORIES}>Add Repository</Link>
        </Button>
      </div>

      {/* Stats cards */}
      {isStatsError ? (
        <Card>
          <ErrorState
            message={(statsError as Error)?.message || 'Failed to load statistics'}
            onRetry={() => refetchStats()}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Repositories"
            value={isStatsLoading ? '-' : formatNumber(stats?.repos ?? 0)}
            icon={<RepositoryIcon className="h-6 w-6" />}
            loading={isStatsLoading}
            color="primary"
            {...(stats?.trends?.repos !== undefined && {
              trend: {
                value: stats.trends.repos,
                isPositive: stats.trends.repos >= 0,
              },
            })}
          />
          <StatsCard
            title="Total Scans"
            value={isStatsLoading ? '-' : formatNumber(stats?.scans ?? 0)}
            icon={<ScanIcon className="h-6 w-6" />}
            loading={isStatsLoading}
            color="success"
            {...(stats?.trends?.scans !== undefined && {
              trend: {
                value: stats.trends.scans,
                isPositive: stats.trends.scans >= 0,
              },
            })}
          />
          <StatsCard
            title="Nodes Analyzed"
            value={isStatsLoading ? '-' : formatNumber(stats?.nodes ?? 0)}
            icon={<BoltIcon className="h-6 w-6" />}
            loading={isStatsLoading}
            color="warning"
            {...(stats?.trends?.nodes !== undefined && {
              trend: {
                value: stats.trends.nodes,
                isPositive: stats.trends.nodes >= 0,
              },
            })}
          />
          <StatsCard
            title="Edges Found"
            value={isStatsLoading ? '-' : formatNumber(stats?.edges ?? 0)}
            icon={<CubeIcon className="h-6 w-6" />}
            loading={isStatsLoading}
            color="primary"
            {...(stats?.trends?.edges !== undefined && {
              trend: {
                value: stats.trends.edges,
                isPositive: stats.trends.edges >= 0,
              },
            })}
          />
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Run New Scan"
            description="Analyze a repository's dependencies"
            icon={<ScanIcon className="h-5 w-5" />}
            href={ROUTES.SCANS}
          />
          <QuickActionCard
            title="View All Repositories"
            description="Manage your connected repositories"
            icon={<RepositoryIcon className="h-5 w-5" />}
            href={ROUTES.REPOSITORIES}
          />
          <QuickActionCard
            title="Configure Settings"
            description="Customize your preferences"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            href={ROUTES.SETTINGS}
          />
        </div>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader
          action={
            <Link
              to={ROUTES.SCANS}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all
            </Link>
          }
        >
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isActivityError ? (
            <ErrorState
              message={(activityError as Error)?.message || 'Failed to load activity'}
              onRetry={() => refetchActivity()}
            />
          ) : isActivityLoading ? (
            <ActivitySkeleton />
          ) : recentActivity.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentActivity.map((activity, index) => (
                <ActivityItem key={index} {...activity} />
              ))}
            </div>
          ) : hasData === false ? (
            <EmptyState />
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">
              No recent activity
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
