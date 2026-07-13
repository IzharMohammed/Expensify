'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { ExpenseDashboard } from '@/components/dashboard/expense-dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { ArrowRight, ReceiptText } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    loading ? (
      <main className="mx-auto min-h-screen max-w-6xl p-6 sm:p-12"><PageSkeleton /></main>
    ) : user ? (
      <ExpenseDashboard />
    ) : (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-5">
        <div className="absolute right-5 top-5"><ThemeToggle /></div>
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-accent blur-3xl" />
        <Card className="relative w-full max-w-2xl overflow-hidden">
          <CardHeader>
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><ReceiptText className="h-6 w-6" /></div>
            <CardTitle className="font-display text-4xl sm:text-5xl">Money clarity starts here.</CardTitle>
            <CardDescription>
              Capture expenses by text, voice, or receipt and understand where your money is going.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/login">
                <Button className="w-full" size="lg">Sign in <ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Link href="/register">
                <Button className="w-full" size="lg" variant="outline">Create account</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  );
}
