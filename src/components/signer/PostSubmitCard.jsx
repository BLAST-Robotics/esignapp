'use client';

export default function PostSubmitCard({
  email,
  setEmail,
  handleMailTo,
  handleDownload,
  handleContinue,
  redirecting,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100 dark:bg-neutral-900 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6 sm:p-8 max-w-md w-full text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 max-h-[90vh] overflow-y-auto">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            aria-hidden="true"
            className="w-7 h-7 text-emerald-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Signed Successfully!</h2>
        <p className="text-sm text-gray-500">Email yourself a copy or download it now.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleMailTo}
            disabled={!email.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-sm"
          >
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email Yourself
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 py-2.5 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={redirecting}
            className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all duration-200 active:scale-[0.98]"
          >
            {redirecting ? 'Redirecting...' : 'Continue'}
          </button>
        </div>
        <p className="text-xs text-gray-400">A download and view link will be included in the email.</p>
      </div>
    </div>
  );
}