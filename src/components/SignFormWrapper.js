'use client';

import dynamic from 'next/dynamic';

const SignForm = dynamic(() => import('@/components/SignForm'), { ssr: false });

export default function SignFormWrapper() {
  return <SignForm />;
}
