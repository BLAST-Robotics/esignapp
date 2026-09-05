'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

const DocumentEditor = dynamic(() => import('./EditorClient'), { ssr: false });

export default function DocumentEditorPage({ params }) {
  const { id } = use(params);
  return (
    <ErrorBoundary>
      <DocumentEditor documentId={id} />
    </ErrorBoundary>
  );
}
