import { HouseholdDetailPage } from '@/components/households/household-detail-page';

export default async function HouseholdDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HouseholdDetailPage householdId={id} />;
}
