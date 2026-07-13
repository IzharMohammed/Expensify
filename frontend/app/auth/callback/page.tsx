'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { refreshAccessToken } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    refreshAccessToken().then((accessToken) => {
      router.replace(accessToken ? '/' : '/login');
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><span className="font-display text-xl italic">L</span></div>
        <div><h1 className="font-display text-3xl">Opening your ledger</h1><p className="mt-2 text-sm text-muted-foreground">Completing secure Google sign-in...</p></div>
        <Skeleton className="mx-auto h-1.5 w-40 rounded-full" />
      </div>
    </main>
  );
}
