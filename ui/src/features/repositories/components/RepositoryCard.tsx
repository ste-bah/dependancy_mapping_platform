/**
 * Repository Card Component
 * Displays repository information in a card format
 * @module features/repositories/components/RepositoryCard
 */

import { memo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Spinner,
} from '@/shared/components';
import { cn } from '@/shared/utils';
import type { Repository, RepositoryProvider, ScanStatus } from '../types';
import { STATUS_CONFIGS, PROVIDER_CONFIGS } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface RepositoryCardProps {
  /** Repository data */
  repository: Repository;
  /** Callback when scan is triggered */
  onTriggerScan?: ((id: string) => void) | undefined;
  /** Callback when scan is cancelled */
  onCancelScan?: ((id: string) => void) | undefined;
  /** Callback when delete is requested */
  onDelete?: ((id: string, name: string) => void) | undefined;
  /** Is scan mutation pending */
  isScanPending?: boolean | undefined;
  /** Is delete mutation pending */
  isDeletePending?: boolean | undefined;
  /** Additional class names */
  className?: string | undefined;
}

// ============================================================================
// Provider Icons
// ============================================================================

interface ProviderIconProps {
  className?: string;
  provider: RepositoryProvider;
}

function ProviderIcon({ className, provider }: ProviderIconProps) {
  switch (provider) {
    case 'github':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      );
    case 'gitlab':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="m23.6 9.593-.033-.086L20.3.98a.85.85 0 0 0-.336-.405.869.869 0 0 0-1.003.063.875.875 0 0 0-.29.44l-2.2 6.748H7.53L5.33 1.078a.857.857 0 0 0-.29-.44.869.869 0 0 0-1.003-.063.85.85 0 0 0-.336.405L.433 9.507l-.032.086a6.066 6.066 0 0 0 2.012 7.01l.01.008.028.02 4.97 3.722 2.458 1.86 1.496 1.13a1.012 1.012 0 0 0 1.22 0l1.497-1.13 2.458-1.86 5-3.745.012-.01a6.068 6.068 0 0 0 2.008-7.005z" />
        </svg>
      );
    case 'bitbucket':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891L.778 1.213zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z" />
        </svg>
      );
    default:
      return null;
  }
}

// ============================================================================
// Status Badge
// ============================================================================

interface ScanStatusBadgeProps {
  status: ScanStatus;
  isScanning?: boolean;
}

function ScanStatusBadge({ status, isScanning }: ScanStatusBadgeProps) {
  const config = STATUS_CONFIGS[status];

  return (
    <Badge variant={config.variant} dot={!isScanning}>
      {isScanning && <Spinner size="xs" className="mr-1" />}
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Relative Time Helper
// ============================================================================

function getRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

// ============================================================================
// Component
// ============================================================================

/**
 * Repository card displaying repository metadata and actions
 *
 * @example
 * <RepositoryCard
 *   repository={repo}
 *   onTriggerScan={(id) => triggerScan.mutate(id)}
 *   onDelete={(id, name) => openDeleteConfirmation(id, name)}
 * />
 */
export const RepositoryCard = memo(function RepositoryCard({
  repository,
  onTriggerScan,
  onCancelScan,
  onDelete,
  isScanPending = false,
  isDeletePending = false,
  className,
}: RepositoryCardProps) {
  const navigate = useNavigate();

  const {
    id,
    provider,
    owner,
    name,
    fullName,
    nodeCount,
    edgeCount,
    lastScanAt,
    lastScanStatus,
    webhookEnabled,
  } = repository;

  const providerConfig = PROVIDER_CONFIGS[provider];
  const isScanning = lastScanStatus === 'scanning' || lastScanStatus === 'pending';
  const canScan = !isScanning && !isScanPending;

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleViewGraph = () => {
    navigate(`/repositories/${id}/graph`);
  };

  const handleTriggerScan = (e: MouseEvent) => {
    e.stopPropagation();
    if (canScan) {
      onTriggerScan?.(id);
    }
  };

  const handleCancelScan = (e: MouseEvent) => {
    e.stopPropagation();
    onCancelScan?.(id);
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id, fullName);
  };

  const handleSettings = (e: MouseEvent) => {
    e.stopPropagation();
    navigate(`/repositories/${id}/settings`);
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card className={cn('group hover:shadow-md transition-shadow', className)}>
      <CardHeader
        action={
          <ScanStatusBadge status={lastScanStatus} isScanning={isScanning} />
        }
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${providerConfig.color}15` }}
          >
            <span style={{ color: providerConfig.color }}>
              <ProviderIcon className="h-5 w-5" provider={provider} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{name}</CardTitle>
            <p className="truncate text-sm text-gray-500">
              {owner}
              {webhookEnabled && (
                <span className="ml-2 text-xs text-green-600">
                  Webhook enabled
                </span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Nodes</p>
            <p className="font-semibold text-gray-900">
              {nodeCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Edges</p>
            <p className="font-semibold text-gray-900">
              {edgeCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Last Scan</p>
            <p className="font-semibold text-gray-900">
              {getRelativeTime(lastScanAt)}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter align="between" className="gap-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewGraph}
            disabled={nodeCount === 0}
          >
            View Graph
          </Button>
          {isScanning ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelScan}
            >
              Cancel
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTriggerScan}
              loading={isScanPending}
              disabled={!canScan}
            >
              Scan Now
            </Button>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSettings}
            aria-label="Settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            loading={isDeletePending}
            aria-label="Delete"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
});

// ============================================================================
// Icon Components
// ============================================================================

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.295a1 1 0 01.804.98v1.36a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.295 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.295A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 015.38 3.05l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default RepositoryCard;
