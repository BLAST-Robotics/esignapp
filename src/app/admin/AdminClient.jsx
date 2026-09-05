'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';

const SignatureChart = dynamic(() => import('@/components/SignatureChart'), { ssr: false, loading: () => <div className="h-32 animate-pulse bg-gray-100 dark:bg-neutral-800 rounded-xl" /> });

function toLocalISO(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getToken() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('ks_token') || '';
  } catch {
    return '';
  }
}

function setToken(t) {
  try {
    if (t) localStorage.setItem('ks_token', t);
    else localStorage.removeItem('ks_token');
  } catch {}
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function AdminClient() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [allSignatures, setAllSignatures] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [dashboardTab, setDashboardTab] = useState('documents');
  const [allUsers, setAllUsers] = useState([]);
  const [editUserId, setEditUserId] = useState(null);
  const [editUserData, setEditUserData] = useState({});
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);

  // Auth form state
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('oauth_token');
    if (oauthToken) {
      setToken(oauthToken);
      window.history.replaceState({}, '', '/admin');
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${oauthToken}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.user) setUser(data.user);
          else setToken('');
        })
        .catch(() => setToken(''))
        .finally(() => setLoading(false));
      return;
    }

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        } else {
          setToken('');
        }
      })
      .catch(() => setToken(''))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/auth/oauth-status')
      .then((r) => r.json())
      .then((d) => setGoogleOAuthEnabled(d.enabled))
      .catch(() => {});
  }, []);

  const apiReq = useCallback(async (url, options = {}) => {
    const headers = { ...options.headers, ...authHeaders() };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      setUser(null);
      setToken('');
      throw new Error('Session expired');
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Request failed');
    }
    return res;
  }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiReq('/api/documents');
      setDocuments((await r.json()).documents);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiReq]);

  useEffect(() => {
    if (user) fetchDocs();
  }, [user, fetchDocs]);

  useEffect(() => {
    if (!user) return;
    apiReq('/api/admin/signatures')
      .then((r) => r.json())
      .then((d) => setAllSignatures(d.signatures || []))
      .catch(() => {});
  }, [user, apiReq]);

  const fetchUsers = useCallback(async () => {
    try {
      const r = await apiReq('/api/admin/users');
      setAllUsers((await r.json()).users || []);
    } catch {}
  }, [apiReq]);

  useEffect(() => {
    if (user?.role === 'admin' && dashboardTab === 'users') fetchUsers();
  }, [user, dashboardTab, fetchUsers]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const r = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Registration failed');
        setAuthMode('login');
        setAuthError('Account created! Sign in.');
      } else {
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Login failed');
        setToken(data.token);
        setUser(data.user);
      }
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    const token = getToken();
    if (token)
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setToken('');
    setUser(null);
    setDocuments([]);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await apiReq('/api/documents', { method: 'POST', body: fd });
      const data = await r.json();
      window.location.href = `/admin/documents/${data.id}`;
    } catch (e) {
      setError(e.message);
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await apiReq(`/api/documents/${id}`, { method: 'DELETE' });
      setDeleteId(null);
      fetchDocs();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading&hellip;
        </div>
      </div>
    );
  }

  if (!user) {
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
            <div
              className={`px-3 py-2 rounded-lg text-xs font-medium ${authError.includes('created') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
            >
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
          <form onSubmit={handleAuth} className="space-y-3">
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
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </a>
            </>
          )}
          <div className="text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError('');
              }}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {authMode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
            </button>
          </div>
          {process.env.NODE_ENV !== 'production' && (
            <div className="text-center text-[10px] text-gray-400 dark:text-neutral-500">
              Dev: use any email + ADMIN_PASSWORD to auto-login
            </div>
          )}
        </div>
      </div>
    );
  }

  const totalSignatures = allSignatures.length;
  const activeDocs = documents.filter((d) => d.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 transition-colors duration-300">
      <header className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-neutral-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-neutral-100">KeySign Dashboard</h1>
            {user.role === 'admin' && (
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 dark:text-neutral-500 hidden sm:inline">{user.email}</span>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
        {user.role === 'admin' && (
          <div className="border-t border-gray-100 dark:border-neutral-800">
            <div className="max-w-7xl mx-auto px-4 flex gap-1 py-2">
              <button
                onClick={() => setDashboardTab('documents')}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${dashboardTab === 'documents' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                Documents
              </button>
              <button
                onClick={() => setDashboardTab('users')}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${dashboardTab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                Users
              </button>
            </div>
          </div>
        )}
      </header>

      {dashboardTab === 'documents' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{documents.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Documents</div>
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-4 shadow-sm">
              <div className="text-2xl font-bold text-emerald-600">{activeDocs}</div>
              <div className="text-xs text-gray-400 mt-0.5">Active</div>
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{totalSignatures}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total Signatures</div>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm">
              {error}
            </div>
          )}

          {allSignatures.length > 0 && (
            <div className="mb-6">
              <SignatureChart signatures={allSignatures} title="All Signatures Over Time" />
            </div>
          )}

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Documents</h2>
              <label
                className={`px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer flex items-center gap-2 shadow-sm ${uploading ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {uploading ? (
                  'Uploading...'
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Upload PDF
                  </>
                )}
                <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
              </label>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading&hellip;
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-neutral-700"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                <p className="text-sm">No documents yet.</p>
                <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">Upload a PDF to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800">
                      <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-neutral-400">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden sm:table-cell">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden sm:table-cell">
                        Signatures
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden md:table-cell">
                        Created
                      </th>
                      <th className="text-right px-5 py-3 font-medium text-gray-600 dark:text-neutral-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/30 cursor-pointer"
                        onClick={() => {
                          if (editingId !== doc.id) window.location.href = `/admin/documents/${doc.id}`;
                        }}
                        onKeyDown={(e) => {
                          if (editingId !== doc.id && (e.key === 'Enter' || e.key === ' ')) {
                            window.location.href = `/admin/documents/${doc.id}`;
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <td
                          className="px-5 py-4"
                          onClick={(e) => {
                            if (editingId === doc.id) e.stopPropagation();
                          }}
                        >
                          {editingId === doc.id ? (
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={async () => {
                                if (editValue.trim()) {
                                  try {
                                    await apiReq(`/api/documents/${doc.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ title: editValue.trim() }),
                                    });
                                    fetchDocs();
                                  } catch {}
                                }
                                setEditingId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="w-full text-sm font-medium text-gray-900 dark:text-neutral-100 bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          ) : (
                            <div
                              className="text-gray-900 dark:text-neutral-100 font-medium group flex items-center gap-1.5"
                              onDoubleClick={() => {
                                setEditingId(doc.id);
                                setEditValue(doc.title);
                              }}
                            >
                              {doc.title}
                              {doc.permission && (
                                <span
                                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${doc.permission === 'manage' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : doc.permission === 'edit' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'}`}
                                >
                                  {doc.permission}
                                </span>
                              )}
                              <svg
                                aria-hidden="true"
                                className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                />
                              </svg>
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-0.5 sm:hidden">
                            {doc.status} &middot; {doc.signature_count || 0} sigs
                          </div>
                        </td>
                        <td className="px-4 py-4 hidden sm:table-cell">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${doc.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'}`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-700 dark:text-neutral-300 hidden sm:table-cell">
                          {doc.signature_count || 0}
                        </td>
                        <td className="px-4 py-4 text-gray-500 text-xs hidden md:table-cell">
                          {toLocalISO(new Date(doc.created_at))}
                        </td>
                        <td
                          className="px-5 py-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setDeleteId(doc.id)}
                            className="px-2.5 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {dashboardTab === 'users' && user.role === 'admin' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200/80 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">User Management</h2>
            </div>
            {allUsers.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800">
                      <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-neutral-400">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden sm:table-cell">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400">Role</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-neutral-400 hidden md:table-cell">
                        Created
                      </th>
                      <th className="text-right px-5 py-3 font-medium text-gray-600 dark:text-neutral-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/30"
                      >
                        <td className="px-5 py-4">
                          {editUserId === u.id ? (
                            <input
                              value={editUserData.email}
                              onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                              className="w-full text-sm text-gray-900 dark:text-neutral-100 bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          ) : (
                            <span className="text-gray-900 dark:text-neutral-100 font-medium">{u.email}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 hidden sm:table-cell">
                          {editUserId === u.id ? (
                            <input
                              value={editUserData.name}
                              onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                              className="w-full text-sm text-gray-700 dark:text-neutral-300 bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          ) : (
                            <span className="text-gray-700 dark:text-neutral-300">{u.name || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {editUserId === u.id ? (
                            <select
                              value={editUserData.role}
                              onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}
                              className="text-xs bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 dark:text-neutral-200"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          ) : (
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400'}`}
                            >
                              {u.role}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-gray-500 text-xs hidden md:table-cell">
                          {toLocalISO(new Date(u.created_at))}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          {editUserId === u.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={async () => {
                                  try {
                                    await apiReq(`/api/admin/users/${u.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(editUserData),
                                    });
                                    setEditUserId(null);
                                    fetchUsers();
                                  } catch (e) {
                                    setError(e.message);
                                  }
                                }}
                                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditUserId(null);
                                  fetchUsers();
                                }}
                                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => {
                                  setEditUserId(u.id);
                                  setEditUserData({ email: u.email, name: u.name || '', role: u.role });
                                }}
                                className="px-2 py-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-xs font-medium transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete user ${u.email}?`)) return;
                                  try {
                                    await apiReq(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                                    fetchUsers();
                                  } catch (e) {
                                    setError(e.message);
                                  }
                                }}
                                className="px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="border-t border-gray-100 dark:border-neutral-900 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs text-gray-400 dark:text-neutral-600">
          &copy; 2026 Keystone STEM Alliance Inc. All Rights Reserved.
        </div>
      </footer>

      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-700 w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Delete Document</h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                Are you sure? This will also remove all signatures for this document.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-700 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
