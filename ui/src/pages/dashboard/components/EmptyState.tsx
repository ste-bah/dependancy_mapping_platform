/**
 * EmptyState Component
 * Empty state display with CTA to add first repository
 * @module pages/dashboard/components/EmptyState
 */

import { Link } from 'react-router-dom';
import { ROUTES } from '@/core';
import { Button } from '@/shared';
import { RepositoryIcon, PlusIcon } from './icons';

/**
 * EmptyState displays when no repositories have been added yet
 */
export function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <RepositoryIcon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-gray-900">
        No repositories yet
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Get started by connecting your first repository
      </p>
      <Button
        variant="primary"
        size="sm"
        className="mt-4"
        leftIcon={<PlusIcon className="h-4 w-4" />}
        asChild
      >
        <Link to={ROUTES.REPOSITORIES}>Add Repository</Link>
      </Button>
    </div>
  );
}
