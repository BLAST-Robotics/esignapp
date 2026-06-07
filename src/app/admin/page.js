'use client';

import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';

const AdminContent = dynamic(() => import('./AdminClient'), { ssr: false });

export default function AdminPage() {
  return (
    <ErrorBoundary>
      <AdminContent />
    </ErrorBoundary>
  );
}
