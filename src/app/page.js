import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-neutral-950">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">E-Sign Platform</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload documents, configure signature fields, and collect legally binding electronic signatures.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/admin"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all shadow-sm text-center">
              Go to Dashboard
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            E-Sign Platform &mdash; Secure &bull; Fast &bull; Free
          </p>
        </div>
      </div>
      <footer className="border-t border-gray-100 dark:border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs text-gray-400 dark:text-neutral-600">
          &copy; 2026 Keystone STEM Alliance Inc. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
