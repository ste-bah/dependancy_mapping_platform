/**
 * Not Found Page
 * 404 error page
 * @module pages/errors/NotFoundPage
 */

import { Link } from 'react-router-dom';
import { ROUTES } from '@/core/router';

/**
 * 404 Not Found page
 */
export default function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          404 error
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Page not found
        </h1>
        <p className="mt-4 text-base text-gray-500">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div className="mt-6">
          <Link
            to={ROUTES.DASHBOARD}
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
}
