/**
 * Application Layout
 * Main layout for authenticated pages with navigation
 * @module layouts/AppLayout
 */

import { useState, useCallback, type ReactNode } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore, selectUser, ROUTES } from '@/core';
import { cn, Badge } from '@/shared';

// ============================================================================
// Icons
// ============================================================================

function DashboardIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function RepositoryIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

function LogoutIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

// ============================================================================
// Navigation Items
// ============================================================================

interface NavItem {
  name: string;
  href: string;
  icon: (props: { className?: string }) => JSX.Element;
  badge?: string;
}

const navigationItems: NavItem[] = [
  { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: DashboardIcon },
  { name: 'Repositories', href: ROUTES.REPOSITORIES, icon: RepositoryIcon },
  { name: 'Scans', href: ROUTES.SCANS, icon: ScanIcon },
  { name: 'Settings', href: ROUTES.SETTINGS, icon: SettingsIcon },
];

// ============================================================================
// User Avatar
// ============================================================================

interface UserAvatarProps {
  avatarUrl?: string | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

function UserAvatar({ avatarUrl, name, size = 'md' }: UserAvatarProps): JSX.Element {
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${name}'s avatar`}
        className={cn('rounded-full object-cover', sizeClasses[size])}
      />
    );
  }

  // Fallback to initials
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary-600 font-medium text-white',
        sizeClasses[size]
      )}
    >
      {initials}
    </div>
  );
}

// ============================================================================
// User Menu Dropdown
// ============================================================================

interface UserMenuProps {
  user: { name: string; email: string; avatarUrl?: string | undefined };
  onLogout: () => void;
}

function UserMenu({ user, onLogout }: UserMenuProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleLogout = useCallback(() => {
    setIsOpen(false);
    onLogout();
  }, [onLogout]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleMenu}
        className={cn(
          'flex items-center gap-2 rounded-full p-1 pr-2',
          'transition-colors hover:bg-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <UserAvatar avatarUrl={user.avatarUrl} name={user.name} />
        <span className="hidden text-sm font-medium text-gray-700 md:block">
          {user.name}
        </span>
        <ChevronDownIcon className={cn('h-4 w-4 text-gray-500 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop for closing menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-lg border bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
            {/* User info */}
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-sm text-gray-500">{user.email}</p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              <NavLink
                to={ROUTES.SETTINGS}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 text-sm',
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  )
                }
              >
                <UserIcon className="h-4 w-4" />
                Your Profile
              </NavLink>
            </div>

            {/* Logout */}
            <div className="border-t py-1">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogoutIcon className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Sidebar Navigation
// ============================================================================

interface SidebarNavProps {
  items: NavItem[];
  onItemClick?: () => void;
}

function SidebarNav({ items, onItemClick }: SidebarNavProps): JSX.Element {
  const location = useLocation();

  return (
    <nav className="space-y-1 px-2">
      {items.map((item) => {
        const isActive = location.pathname === item.href ||
          (item.href !== ROUTES.DASHBOARD && location.pathname.startsWith(item.href));

        return (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onItemClick}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              'transition-colors duration-150',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <item.icon
              className={cn(
                'h-5 w-5 shrink-0',
                isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
              )}
            />
            {item.name}
            {item.badge && (
              <Badge variant="primary" size="sm" className="ml-auto">
                {item.badge}
              </Badge>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

// ============================================================================
// Mobile Sidebar
// ============================================================================

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

function MobileSidebar({ isOpen, onClose, children }: MobileSidebarProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-600/75 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <span className="text-xl font-bold text-gray-900">Code Reviewer</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          >
            <CloseIcon className="h-6 w-6" />
            <span className="sr-only">Close sidebar</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Layout Component
// ============================================================================

/**
 * Main application layout
 * Provides consistent structure for authenticated pages
 */
export default function AppLayout(): JSX.Element {
  const user = useAuthStore(selectUser);
  const logout = useAuthStore((state) => state.logout);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-white">
        <div className="flex h-16 items-center justify-between px-4">
          {/* Left side: mobile menu + logo */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 lg:hidden"
            >
              <MenuIcon className="h-6 w-6" />
              <span className="sr-only">Open sidebar</span>
            </button>

            {/* Logo */}
            <NavLink to={ROUTES.DASHBOARD} className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="hidden text-xl font-bold text-gray-900 sm:block">
                Code Reviewer
              </span>
            </NavLink>
          </div>

          {/* Right side: user menu */}
          {user && (
            <UserMenu
              user={{
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }}
              onLogout={handleLogout}
            />
          )}
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r bg-white lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-4">
            <SidebarNav items={navigationItems} />
          </div>
        </aside>

        {/* Mobile sidebar */}
        <MobileSidebar isOpen={mobileSidebarOpen} onClose={closeMobileSidebar}>
          <SidebarNav items={navigationItems} onItemClick={closeMobileSidebar} />
        </MobileSidebar>

        {/* Main content area */}
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
