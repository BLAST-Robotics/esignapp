'use client';

export default function AuthView({
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authName,
  setAuthName,
  authError,
  authLoading,
  googleOAuthEnabled,
  onSubmit,
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4 transition-colors duration-300">
      <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-700 w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-neutral-100">KeySign</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            {authMode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>
        {authError && (
          <div className={`px-3 py-2 rounded-lg text-xs font-medium ${authError.includes('created') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {authError}
          </div>
        )}
        {googleOAuthEnabled &&
          (new URLSearchParams(window.location.search).get('oauth_error') === 'no_session' ||
            new URLSearchParams(window.location.search).get('oauth_error') === 'exchange_failed') && (
            <div className="px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600">
              Google sign-in failed. Please try again.
            </div>
          )}
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-900 dark:text-neutral-200"
          />
          {authMode === 'register' && (
            <input
              type="text"
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-900 dark:text-neutral-200"
            />
          )}
          <input
            type="password"
            required
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-900 dark:text-neutral-200"
          />
          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        {googleOAuthEnabled && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-neutral-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-neutral-800 px-2 text-gray-400 dark:text-neutral-500">or</span>
              </div>
            </div>
            <a
              href="/api/auth/signin/google?callbackUrl=/api/auth/oauth-exchange"
              className="w-full py-2.5 px-4 border border-gray-300 dark:border-neutral-600 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </a>
          </>
        )}
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
            }}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {authMode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </button>
        </div>
        {process.env.NODE_ENV !== 'production' && (
          <div className="text-center text-[10px] text-gray-400 dark:text-neutral-500">Dev: use any email + ADMIN_PASSWORD to auto-login</div>
        )}
      </div>
    </div>
  );
}
