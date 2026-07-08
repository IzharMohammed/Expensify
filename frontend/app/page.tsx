'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  const { user, loading, logout } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl border-white/70 bg-white/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Expense auth starter</CardTitle>
          <CardDescription>
            Access token lives in memory, refresh token stays in an httpOnly cookie, and Google OAuth is ready to plug in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Restoring session...</p>
          ) : user ? (
            <>
              <div className="rounded-lg bg-secondary p-4 text-sm">
                <p className="font-medium">{user.name}</p>
                <p>{user.email}</p>
                <p className="capitalize text-muted-foreground">{user.authProvider}</p>
              </div>
              <Button onClick={() => logout()}>Logout</Button>
            </>
          ) : (
            <div className="flex gap-3">
              <Link href="/login">
                <Button>Login</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline">Register</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
