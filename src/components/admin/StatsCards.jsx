'use client';

export default function StatsCards({ documents, activeDocs, totalSignatures }) {
  return (
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
  );
}
