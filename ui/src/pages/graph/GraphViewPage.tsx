/**
 * Graph View Page
 * Interactive dependency graph visualization
 * @module pages/graph/GraphViewPage
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { ROUTES } from '@/core';
import { Button, Card, CardContent } from '@/shared';
import { cn } from '@/shared/utils';
import {
  GraphCanvas,
  GraphSkeleton,
  GraphEmptyState,
  GraphErrorBoundary,
  GraphErrorDisplay,
  GraphToolbar,
  GraphLegend,
} from '@/features/graph/components';
import { useGraph } from '@/features/graph/hooks';

// ============================================================================
// Icons
// ============================================================================

function ArrowLeftIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
      />
    </svg>
  );
}

function ExpandIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
      />
    </svg>
  );
}

function CollapseIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
      />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

interface GraphViewPageState {
  isFullscreen: boolean;
  showLegend: boolean;
  zoomLevel: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Graph visualization page
 * Displays interactive dependency graph for a scan
 */
export default function GraphViewPage(): JSX.Element {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<GraphViewPageState>({
    isFullscreen: false,
    showLegend: true,
    zoomLevel: 1,
  });

  // Pre-fetch graph data to check loading/error states
  const { isLoading, isError, error, graphData, refetch } = useGraph({
    scanId: scanId ?? '',
  });

  // Handle fullscreen toggle
  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setState((prev) => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setState((prev) => ({ ...prev, isFullscreen: false }));
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    function handleFullscreenChange(): void {
      setState((prev) => ({
        ...prev,
        isFullscreen: !!document.fullscreenElement,
      }));
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      // Escape to exit fullscreen
      if (event.key === 'Escape' && state.isFullscreen) {
        document.exitFullscreen();
      }
      // L to toggle legend
      if (event.key === 'l' && !event.metaKey && !event.ctrlKey) {
        setState((prev) => ({ ...prev, showLegend: !prev.showLegend }));
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isFullscreen]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (scanId) {
      navigate(ROUTES.SCAN_DETAIL(scanId));
    } else {
      navigate(ROUTES.SCANS);
    }
  }, [navigate, scanId]);

  // Handle export (placeholder for actual implementation)
  const handleExport = useCallback((format: 'png' | 'svg' | 'json') => {
    // Export functionality - placeholder until implemented
    void format; // Suppress unused parameter warning
    // TODO: Implement actual export functionality
  }, []);

  // Guard: No scan ID
  if (!scanId) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <GraphErrorDisplay
          error="No scan ID provided"
          onRetry={() => navigate(ROUTES.SCANS)}
        />
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          scanId={scanId}
          onBack={handleBack}
          isFullscreen={state.isFullscreen}
          onFullscreen={handleFullscreen}
        />
        <div className="h-[calc(100vh-220px)] min-h-[500px] rounded-lg border bg-white shadow-sm overflow-hidden">
          <GraphSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          scanId={scanId}
          onBack={handleBack}
          isFullscreen={state.isFullscreen}
          onFullscreen={handleFullscreen}
        />
        <Card>
          <CardContent className="py-0">
            <GraphErrorDisplay
              error={error ?? 'Failed to load graph data'}
              onRetry={() => refetch()}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          scanId={scanId}
          onBack={handleBack}
          isFullscreen={state.isFullscreen}
          onFullscreen={handleFullscreen}
        />
        <Card>
          <CardContent className="py-0">
            <GraphEmptyState
              onAction={() => navigate(ROUTES.SCANS)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main graph view
  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col',
        state.isFullscreen && 'fixed inset-0 z-50 bg-white'
      )}
    >
      {/* Header */}
      <div className={cn(state.isFullscreen ? 'p-4' : 'mb-6')}>
        <PageHeader
          scanId={scanId}
          onBack={handleBack}
          isFullscreen={state.isFullscreen}
          onFullscreen={handleFullscreen}
          showStats
          nodeCount={graphData.nodes.length}
          edgeCount={graphData.edges.length}
        />
      </div>

      {/* Graph Container */}
      <div
        className={cn(
          'relative rounded-lg border bg-white shadow-sm overflow-hidden',
          state.isFullscreen
            ? 'flex-1'
            : 'h-[calc(100vh-220px)] min-h-[500px]'
        )}
      >
        <GraphErrorBoundary onRetry={() => refetch()}>
          <ReactFlowProvider>
            <GraphCanvas
              scanId={scanId}
              showFilters
              showSearch
              showDetails
              showMinimap
              className="h-full w-full"
            />
          </ReactFlowProvider>
        </GraphErrorBoundary>

        {/* Legend Overlay */}
        {state.showLegend && (
          <div className="absolute bottom-4 right-4 z-10">
            <GraphLegend compact />
          </div>
        )}

        {/* Toolbar Overlay */}
        <div className="absolute top-4 right-4 z-10">
          <GraphToolbar
            zoomLevel={state.zoomLevel}
            isFullscreen={state.isFullscreen}
            onFullscreen={handleFullscreen}
            onExport={handleExport}
            position="top-right"
          />
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      {!state.isFullscreen && (
        <div className="mt-4 flex items-center justify-end gap-4 text-xs text-gray-500">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">L</kbd>
            {' '}Toggle legend
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">F</kbd>
            {' '}Fullscreen
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Esc</kbd>
            {' '}Exit fullscreen
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Page Header Component
// ============================================================================

interface PageHeaderProps {
  scanId: string;
  onBack: () => void;
  isFullscreen: boolean;
  onFullscreen: () => void;
  showStats?: boolean;
  nodeCount?: number;
  edgeCount?: number;
}

function PageHeader({
  scanId,
  onBack,
  isFullscreen,
  onFullscreen,
  showStats = false,
  nodeCount = 0,
  edgeCount = 0,
}: PageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
          onClick={onBack}
          aria-label="Go back"
        >
          Back
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Dependency Graph
            </h1>
            {showStats && (
              <span className="text-sm text-gray-500">
                ({nodeCount} nodes, {edgeCount} edges)
              </span>
            )}
          </div>
          <nav className="mt-1 text-sm text-gray-500" aria-label="Breadcrumb">
            <ol className="flex items-center gap-1">
              <li>
                <Link
                  to={ROUTES.SCANS}
                  className="hover:text-primary-600 transition-colors"
                >
                  Scans
                </Link>
              </li>
              <li className="text-gray-400">/</li>
              <li>
                <Link
                  to={ROUTES.SCAN_DETAIL(scanId)}
                  className="hover:text-primary-600 transition-colors"
                >
                  {scanId.slice(0, 8)}...
                </Link>
              </li>
              <li className="text-gray-400">/</li>
              <li className="text-gray-900" aria-current="page">
                Graph
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          leftIcon={isFullscreen ? <CollapseIcon className="h-4 w-4" /> : <ExpandIcon className="h-4 w-4" />}
          onClick={onFullscreen}
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </Button>
      </div>
    </div>
  );
}
