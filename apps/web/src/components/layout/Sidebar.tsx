'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  FolderTree,
  Repeat,
  Settings,
  Sparkles,
  LogOut,
  Link2,
  Moon,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/lib/theme';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, preserveMonth: true },
  { name: 'Transactions', href: '/transactions', icon: Receipt, preserveMonth: true },
  { name: 'Budget', href: '/budget', icon: PieChart, preserveMonth: true },
  { name: 'Categories', href: '/categories', icon: FolderTree, preserveMonth: false },
  { name: 'Rules', href: '/rules', icon: Sparkles, preserveMonth: false },
  { name: 'Recurring', href: '/recurring', icon: Repeat, preserveMonth: false },
  { name: 'Connections', href: '/connections', icon: Link2, preserveMonth: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { theme, toggleTheme, mounted } = useTheme();

  const getHref = (item: typeof navigation[number]) => {
    if (item.preserveMonth) {
      const month = searchParams.get('month');
      if (month) {
        return `${item.href}?month=${month}`;
      }
    }
    return item.href;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="hidden w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 lg:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Sharristh</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Budget Tracker</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={getHref(item)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {mounted && theme === 'dark' ? (
              <>
                <Sun className="h-5 w-5" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="h-5 w-5" />
                Dark Mode
              </>
            )}
          </button>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    </aside>
  );
}

