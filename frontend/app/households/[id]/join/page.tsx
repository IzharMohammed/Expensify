import { Suspense } from 'react';
import { JoinHouseholdPage } from '@/components/households/join-household-page';

export default async function JoinHouseholdRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><JoinHouseholdPage householdId={id} /></Suspense>;
}
