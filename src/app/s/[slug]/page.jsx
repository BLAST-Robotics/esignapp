import { redirect } from 'next/navigation';
import { getDocumentBySlug } from '@/lib/storage';

export default async function SlugPage({ params }) {
  const { slug } = await params;
  const doc = await getDocumentBySlug(slug);
  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Not Found</h1>
          <p className="text-sm text-gray-500 mt-2">This document could not be found.</p>
        </div>
      </div>
    );
  }
  redirect(`/sign/${doc.id}`);
}
