'use client';

import ThemeToggle from '@/components/ThemeToggle';

export default function AdminHeader({ user, dashboardTab, setDashboardTab, onLogout }) {
  return (
    <header className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-neutral-800 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-neutral-100">KeySign Dashboard</h1>
          {user.role === 'admin' && (
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Admin</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-neutral-500 hidden sm:inline">{user.email}</span>
          <ThemeToggle />
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
      {user.role === 'admin' && (
        <div className="border-t border-gray-100 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto px-4 flex gap-1 py-2">
            <button
              type="button"
              onClick={() => setDashboardTab('documents')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${dashboardTab === 'documents' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              Documents
            </button>
            <button
              type="button"
              onClick={() => setDashboardTab('users')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${dashboardTab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              Users
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
