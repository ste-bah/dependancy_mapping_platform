/**
 * Scan Timeline Chart Component
 * Recharts-based timeline visualization for scan history
 * @module features/scan-history/components/ScanTimelineChart
 */

import { memo, useMemo, useCallback, useState } from 'react';
import {
  ComposedChart,
  Area,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Button, Badge } from '@/shared';
import { cn } from '@/shared/utils';
import type { ScanTimelineChartProps } from '../types';
import type { TimelineDataPoint } from '../types';
import type { TimelineZoom, ScanId } from '../types';
import { SCAN_STATUS_COLORS } from '../types';

// ============================================================================
// Constants
// ============================================================================

const ZOOM_LABELS: Record<TimelineZoom, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

const ZOOM_OPTIONS: TimelineZoom[] = ['day', 'week', 'month', 'quarter'];

// ============================================================================
// Icons
// ============================================================================

function ZoomInIcon({ className }: { className?: string }): JSX.Element {
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
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
      />
    </svg>
  );
}

function ZoomOutIcon({ className }: { className?: string }): JSX.Element {
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
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6"
      />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

interface ChartDataPoint extends TimelineDataPoint {
  formattedDate: string;
  successRate: number;
  failedPercent: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateStr: string, zoom: TimelineZoom): string {
  const date = new Date(dateStr);
  switch (zoom) {
    case 'day':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'week':
      return `W${getWeekNumber(date)} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
    case 'year':
      return date.getFullYear().toString();
    default:
      return dateStr;
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ============================================================================
// Custom Tooltip Component
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: ChartDataPoint;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-white p-3 shadow-lg">
      <p className="font-medium text-gray-900 mb-2">{data.formattedDate}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-600">Total Scans:</span>
          <span className="font-medium">{data.scanCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-green-600">Completed:</span>
          <span className="font-medium text-green-600">{data.completedCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-red-600">Failed:</span>
          <span className="font-medium text-red-600">{data.failedCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t">
          <span className="text-gray-600">Avg Duration:</span>
          <span className="font-medium">{formatDuration(data.averageDuration)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-600">Total Issues:</span>
          <span className="font-medium">{data.totalIssues}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Custom Scatter Point Component
// ============================================================================

interface ScatterPointProps {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
  isSelected?: boolean;
  onClick?: () => void;
}

function ScatterPoint({
  cx = 0,
  cy = 0,
  payload,
  isSelected,
  onClick,
}: ScatterPointProps): JSX.Element | null {
  if (!payload || payload.scanCount === 0) {
    return null;
  }

  const successRate = payload.completedCount / payload.scanCount;
  const color = successRate >= 0.9
    ? SCAN_STATUS_COLORS.completed
    : successRate >= 0.5
    ? '#eab308' // yellow-500
    : SCAN_STATUS_COLORS.failed;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isSelected ? 8 : 5}
      fill={color}
      stroke={isSelected ? '#1f2937' : 'white'}
      strokeWidth={isSelected ? 2 : 1.5}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    />
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Timeline chart for visualizing scan history
 *
 * @example
 * <ScanTimelineChart
 *   data={timelineData}
 *   zoom="week"
 *   onZoomChange={handleZoomChange}
 *   onDateRangeChange={handleDateRangeChange}
 *   selectedScanId={selectedId}
 *   onScanSelect={handleScanSelect}
 * />
 */
function ScanTimelineChartComponent({
  data,
  zoom,
  onZoomChange,
  onDateRangeChange,
  selectedScanId,
  onScanSelect,
  isLoading = false,
  className,
  height = 300,
  showLegend = true,
  enableBrush = false,
  enableZoomControls = true,
}: ScanTimelineChartProps): JSX.Element {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Transform data for chart
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return data.map((point) => ({
      ...point,
      formattedDate: formatDate(point.date, zoom),
      successRate: point.scanCount > 0
        ? (point.completedCount / point.scanCount) * 100
        : 0,
      failedPercent: point.scanCount > 0
        ? (point.failedCount / point.scanCount) * 100
        : 0,
    }));
  }, [data, zoom]);

  // Calculate max values for Y-axis
  const maxScanCount = useMemo(() => {
    return Math.max(...data.map((d) => d.scanCount), 10);
  }, [data]);

  const maxIssues = useMemo(() => {
    return Math.max(...data.map((d) => d.totalIssues), 10);
  }, [data]);

  // Handle zoom in/out
  const handleZoomIn = useCallback(() => {
    const currentIndex = ZOOM_OPTIONS.indexOf(zoom);
    if (currentIndex > 0) {
      onZoomChange(ZOOM_OPTIONS[currentIndex - 1]);
    }
  }, [zoom, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const currentIndex = ZOOM_OPTIONS.indexOf(zoom);
    if (currentIndex < ZOOM_OPTIONS.length - 1) {
      onZoomChange(ZOOM_OPTIONS[currentIndex + 1]);
    }
  }, [zoom, onZoomChange]);

  // Handle point click - currently a no-op as timeline points are aggregated
  // TODO: Implement drill-down to show scans for the selected date
  const handlePointClick = useCallback(
    (_index: number) => {
      // Timeline data points are aggregates - they don't have individual scan IDs
      // A future enhancement could show a modal/popover with scans for that date
      // For now, this is intentionally a no-op
    },
    []
  );

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-50 rounded-lg',
          className
        )}
        style={{ height }}
      >
        <div className="animate-pulse text-gray-400">Loading chart...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-gray-50 rounded-lg text-gray-500',
          className
        )}
        style={{ height }}
      >
        <ChartEmptyIcon className="h-12 w-12 mb-2 text-gray-300" />
        <p>No timeline data available</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Zoom Controls */}
      {enableZoomControls && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Zoom:</span>
            <div className="flex rounded-lg border bg-white p-0.5">
              {ZOOM_OPTIONS.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => onZoomChange(z)}
                  className={cn(
                    'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                    zoom === z
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {ZOOM_LABELS[z]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={ZOOM_OPTIONS.indexOf(zoom) === 0}
              aria-label="Zoom in"
            >
              <ZoomInIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={ZOOM_OPTIONS.indexOf(zoom) === ZOOM_OPTIONS.length - 1}
              aria-label="Zoom out"
            >
              <ZoomOutIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="scanCountGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="issuesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />

            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxScanCount * 1.2]}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxIssues * 1.2]}
            />

            <Tooltip content={<CustomTooltip />} />

            {showLegend && (
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-gray-600">{value}</span>
                )}
              />
            )}

            {/* Scan count area */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="scanCount"
              name="Scans"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#scanCountGradient)"
            />

            {/* Issues area (secondary) */}
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="totalIssues"
              name="Issues"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#issuesGradient)"
              opacity={0.7}
            />

            {/* Scatter points for individual scans */}
            <Scatter
              yAxisId="left"
              dataKey="scanCount"
              fill="#3b82f6"
              shape={(props: any) => (
                <ScatterPoint
                  {...props}
                  isSelected={hoveredIndex === props.index}
                  onClick={() => handlePointClick(props.index)}
                />
              )}
              onMouseEnter={(data: any, index: number) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />

            {/* Average line */}
            {chartData.length > 1 && (
              <ReferenceLine
                yAxisId="left"
                y={chartData.reduce((sum, d) => sum + d.scanCount, 0) / chartData.length}
                stroke="#9ca3af"
                strokeDasharray="5 5"
                label={{
                  value: 'Avg',
                  position: 'insideTopRight',
                  fill: '#9ca3af',
                  fontSize: 10,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-gray-600">
            Total: <strong>{data.reduce((sum, d) => sum + d.scanCount, 0)}</strong> scans
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span className="text-gray-600">
            Completed: <strong>{data.reduce((sum, d) => sum + d.completedCount, 0)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-gray-600">
            Failed: <strong>{data.reduce((sum, d) => sum + d.failedCount, 0)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Icon
// ============================================================================

function ChartEmptyIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605"
      />
    </svg>
  );
}

export const ScanTimelineChart = memo(ScanTimelineChartComponent);

export type { ScanTimelineChartProps };
