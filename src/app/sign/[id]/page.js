'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';

const DocumentSigner = dynamic(() => import('@/components/DocumentSigner'), { ssr: false });

export default function SignPage({ params }) {
  const { id } = use(params);
  return <ErrorBoundary><DocumentSigner documentId={id} /></ErrorBoundary>;
}
