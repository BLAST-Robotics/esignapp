'use client';

export default function EmailGate({ signerEmail, setSignerEmail, setMessage }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100 dark:bg-neutral-900 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-700 p-6 sm:p-8 max-w-md w-full text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto">
          <svg
            aria-hidden="true"
            className="w-7 h-7 text-blue-600"
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
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Enter your email</h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400">We'll use this to send your signed document.</p>
        <input
          type="email"
          value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full px-4 py-2.5 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-neutral-200"
        />
        <button
          type="button"
          onClick={() => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) {
              setMessage({ type: 'error', text: 'Please enter a valid email address' });
              return;
            }
            setMessage(null);
          }}
          disabled={!signerEmail.trim()}
          className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
        >
          Start Signing
        </button>
      </div>
    </div>
  );
}