/**
 * Repository Detail Page
 * Single repository view with scans
 * @module pages/repositories/RepositoryDetailPage
 */

import { useParams } from 'react-router-dom';

/**
 * Repository detail page
 */
export default function RepositoryDetailPage(): JSX.Element {
  const { owner, name } = useParams<{ owner: string; name: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {owner}/{name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Repository details and scan history
        </p>
      </div>

      {/* Repository details placeholder */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          Repository details will be implemented in a future phase.
        </p>
      </div>
    </div>
  );
}
