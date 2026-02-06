/**
 * Scan Detail Page
 * Single scan view with results
 * @module pages/scans/ScanDetailPage
 */

import { useParams, Link } from 'react-router-dom';
import { ROUTES } from '@/core/router';

/**
 * Scan detail page
 */
export default function ScanDetailPage(): JSX.Element {
  const { scanId } = useParams<{ scanId: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Scan Details
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Scan ID: {scanId}
          </p>
        </div>
        <Link
          to={ROUTES.SCAN_GRAPH(scanId ?? '')}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          View Graph
        </Link>
      </div>

      {/* Scan details placeholder */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          Scan details will be implemented in a future phase.
        </p>
      </div>
    </div>
  );
}
