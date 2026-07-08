'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExploreRedirect() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/designs?limit=1&sort=popular')
      .then(r => r.json())
      .then(json => {
        const first = json.data?.[0] || json.data?.designs?.[0];
        if (first?.id) router.replace(`/explore/${first.id}`);
        else router.replace('/');
      })
      .catch(() => router.replace('/'));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
    </div>
  );
}
