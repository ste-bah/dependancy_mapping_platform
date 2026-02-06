/**
 * QuickActionCard Component
 * Navigation card for quick access to common actions
 * @module pages/dashboard/components/QuickActionCard
 */

import { type ReactNode, memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from './icons';

export interface QuickActionCardProps {
  /** Action title */
  title: string;
  /** Action description */
  description: string;
  /** Icon element to display */
  icon: ReactNode;
  /** Navigation destination */
  href: string;
}

/**
 * QuickActionCard provides a navigable card for common actions
 */
export const QuickActionCard = memo(function QuickActionCard({
  title,
  description,
  icon,
  href,
}: QuickActionCardProps): JSX.Element {
  return (
    <Link
      to={href}
      className="group block rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-primary-300 hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors group-hover:bg-primary-100 group-hover:text-primary-600">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900 group-hover:text-primary-600">
            {title}
          </h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <ArrowRightIcon className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-primary-600" />
      </div>
    </Link>
  );
});
