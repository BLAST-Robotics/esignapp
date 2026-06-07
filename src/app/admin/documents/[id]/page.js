'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';

const DocumentEditor = dynamic(() => import('./EditorClient'), { ssr: false });

export default function DocumentEditorPage({ params }) {
  const { id } = use(params);
  return <ErrorBoundary><DocumentEditor documentId={id} /></ErrorBoundary>;
}
