'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { refreshAccessToken } from '@/lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    refreshAccessToken().then((accessToken) => {
      router.replace(accessToken ? '/' : '/login');
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Completing Google sign-in...</p>
    </main>
  );
}
