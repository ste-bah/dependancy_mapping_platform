/**
 * Settings Page
 * User and application settings
 * @module pages/settings/SettingsPage
 */

import { useParams, Link } from 'react-router-dom';
import { useAuthStore, selectUser } from '@/core/auth';

/**
 * Settings page
 */
export default function SettingsPage(): JSX.Element {
  const { section } = useParams<{ section: string }>();
  const user = useAuthStore(selectUser);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and application settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <nav className="space-y-1">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'api-keys', label: 'API Keys' },
            { id: 'notifications', label: 'Notifications' },
          ].map((item) => (
            <Link
              key={item.id}
              to={`/settings/${item.id}`}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                section === item.id
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>

            {user && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4">
                  {user.avatarUrl && (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="h-16 w-16 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>

                <hr />

                <div>
                  <button
                    onClick={() => void logout()}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
