'use client';

import { useEffect, useState } from 'react';

export default function PdfDocument({ file, onLoadSuccess, loading, error, children }) {
  const [Comp, setComp] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      import('react-pdf').then((mod) => {
        if (cancelled) return;
        mod.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        setComp(() => mod.Document);
      });
    };
    // Defer heavy pdfjs off TBT critical window, but keep LCP <2s by loading after FCP
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(load, { timeout: 800 });
      return () => { cancelled = true; cancelIdleCallback(id); };
    }
    const t = setTimeout(load, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  if (!Comp) return loading ?? null;
  return (
    <Comp file={file} onLoadSuccess={onLoadSuccess} loading={loading} error={error}>
      {children}
    </Comp>
  );
}
