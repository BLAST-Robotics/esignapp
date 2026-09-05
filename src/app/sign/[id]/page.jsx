'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

const DocumentSigner = dynamic(() => import('@/components/DocumentSigner'), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-neutral-900"><div className="flex items-center gap-2 text-gray-400 text-sm"><svg aria-hidden="true" className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Loading document…</div></div>,
});

export default function SignPage({ params }) {
  const { id } = use(params);
  return (
    <ErrorBoundary>
      <DocumentSigner documentId={id} />
    </ErrorBoundary>
  );
}
