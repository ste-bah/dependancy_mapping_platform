/**
 * Scans Page
 * List of all scans
 * @module pages/scans/ScansPage
 */

/**
 * Scans list page
 */
export default function ScansPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scans</h1>
        <p className="mt-1 text-sm text-gray-500">
          View all dependency graph scans
        </p>
      </div>

      {/* Scans list placeholder */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          Scans list will be implemented in a future phase.
        </p>
      </div>
    </div>
  );
}
