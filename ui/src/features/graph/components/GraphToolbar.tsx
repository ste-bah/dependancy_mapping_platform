/**
 * GraphToolbar Component
 * Toolbar with layout controls, export options, and view controls
 * @module features/graph/components/GraphToolbar
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button, IconButton } from '@/shared';
import { cn } from '@/shared/utils';
import type { GraphToolbarProps } from '../types/components';

// ============================================================================
// Icons
// ============================================================================

function ZoomInIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
    </svg>
  );
}

function ZoomOutIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
    </svg>
  );
}

function FitViewIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  );
}

function FullscreenIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  );
}

function ExitFullscreenIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function LayoutIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

type ExportFormat = 'png' | 'svg' | 'json';

interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  { format: 'png', label: 'PNG Image', description: 'High-quality raster image' },
  { format: 'svg', label: 'SVG Vector', description: 'Scalable vector graphic' },
  { format: 'json', label: 'JSON Data', description: 'Raw graph data' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Graph toolbar with zoom, layout, and export controls
 */
export function GraphToolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetView,
  onExport,
  onFullscreen,
  zoomLevel = 1,
  isFullscreen = false,
  className,
  position = 'top-right',
  orientation = 'horizontal',
}: GraphToolbarProps): JSX.Element {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(event.target as Node)) {
        setShowLayoutMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = useCallback((format: ExportFormat) => {
    onExport?.(format);
    setShowExportMenu(false);
  }, [onExport]);

  const isVertical = orientation === 'vertical';
  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div
      className={cn(
        'flex gap-1 bg-white rounded-lg border border-gray-200 shadow-sm p-1',
        isVertical ? 'flex-col' : 'flex-row items-center',
        className
      )}
      role="toolbar"
      aria-label="Graph toolbar"
    >
      {/* Zoom Controls */}
      <div className={cn('flex gap-1', isVertical ? 'flex-col' : 'flex-row items-center')}>
        <IconButton
          icon={<ZoomOutIcon className="h-4 w-4" />}
          aria-label="Zoom out"
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          disabled={!onZoomOut}
        />

        {/* Zoom Level Display */}
        <span
          className={cn(
            'text-xs font-medium text-gray-600 min-w-[45px] text-center',
            isVertical && 'py-1'
          )}
          aria-label={`Zoom level: ${zoomPercent}%`}
        >
          {zoomPercent}%
        </span>

        <IconButton
          icon={<ZoomInIcon className="h-4 w-4" />}
          aria-label="Zoom in"
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          disabled={!onZoomIn}
        />
      </div>

      {/* Divider */}
      <div className={cn(
        'bg-gray-200',
        isVertical ? 'h-px w-full my-1' : 'w-px h-6 mx-1'
      )} />

      {/* View Controls */}
      <div className={cn('flex gap-1', isVertical ? 'flex-col' : 'flex-row')}>
        <IconButton
          icon={<FitViewIcon className="h-4 w-4" />}
          aria-label="Fit view to content"
          variant="ghost"
          size="sm"
          onClick={onFitView}
          disabled={!onFitView}
        />

        {onFullscreen && (
          <IconButton
            icon={isFullscreen ? <ExitFullscreenIcon className="h-4 w-4" /> : <FullscreenIcon className="h-4 w-4" />}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            variant="ghost"
            size="sm"
            onClick={onFullscreen}
          />
        )}
      </div>

      {/* Divider */}
      {onExport && (
        <div className={cn(
          'bg-gray-200',
          isVertical ? 'h-px w-full my-1' : 'w-px h-6 mx-1'
        )} />
      )}

      {/* Export Dropdown */}
      {onExport && (
        <div ref={exportMenuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<DownloadIcon className="h-4 w-4" />}
            rightIcon={<ChevronDownIcon className={cn('h-3 w-3 transition-transform', showExportMenu && 'rotate-180')} />}
            onClick={() => setShowExportMenu(!showExportMenu)}
            aria-expanded={showExportMenu}
            aria-haspopup="menu"
          >
            Export
          </Button>

          {showExportMenu && (
            <div
              className={cn(
                'absolute z-50 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5',
                position.includes('right') ? 'right-0' : 'left-0'
              )}
              role="menu"
              aria-orientation="vertical"
            >
              <div className="py-1">
                {EXPORT_OPTIONS.map((option) => (
                  <button
                    key={option.format}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    role="menuitem"
                    onClick={() => handleExport(option.format)}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Toolbar Variant
// ============================================================================

export interface GraphToolbarCompactProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  zoomLevel?: number;
  className?: string;
}

/**
 * Compact toolbar for embedded use or mobile
 */
export function GraphToolbarCompact({
  onZoomIn,
  onZoomOut,
  onFitView,
  zoomLevel = 1,
  className,
}: GraphToolbarCompactProps): JSX.Element {
  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 bg-white/90 backdrop-blur rounded-md border border-gray-200 shadow-sm px-1 py-0.5',
        className
      )}
      role="toolbar"
      aria-label="Graph zoom controls"
    >
      <IconButton
        icon={<ZoomOutIcon className="h-3.5 w-3.5" />}
        aria-label="Zoom out"
        variant="ghost"
        size="sm"
        onClick={onZoomOut}
        disabled={!onZoomOut}
        className="h-7 w-7"
      />
      <span className="text-xs font-medium text-gray-600 min-w-[36px] text-center">
        {zoomPercent}%
      </span>
      <IconButton
        icon={<ZoomInIcon className="h-3.5 w-3.5" />}
        aria-label="Zoom in"
        variant="ghost"
        size="sm"
        onClick={onZoomIn}
        disabled={!onZoomIn}
        className="h-7 w-7"
      />
      <div className="w-px h-4 bg-gray-200 mx-0.5" />
      <IconButton
        icon={<FitViewIcon className="h-3.5 w-3.5" />}
        aria-label="Fit view"
        variant="ghost"
        size="sm"
        onClick={onFitView}
        disabled={!onFitView}
        className="h-7 w-7"
      />
    </div>
  );
}

export default GraphToolbar;
