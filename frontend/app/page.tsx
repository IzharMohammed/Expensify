'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { ExpenseDashboard } from '@/components/dashboard/expense-dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    loading ? (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Restoring session...</p>
      </main>
    ) : user ? (
      <ExpenseDashboard />
    ) : (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-xl border-white/70 bg-white/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Expense capture starter</CardTitle>
            <CardDescription>
              Sign in to use text, voice, and receipt-based expense entry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Link href="/login">
                <Button>Login</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline">Register</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  );
}
