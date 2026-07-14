export type HouseholdMember = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'owner' | 'member';
  joinedAt: string;
};

export type Household = {
  id: string;
  name: string;
  ownerId: string;
  role: 'owner' | 'member';
  members: HouseholdMember[];
};

export type HouseholdDebt = {
  fromUserId: string;
  toUserId: string;
  amount: string;
};

export type HouseholdBalances = {
  currentUserId: string;
  members: HouseholdMember[];
  debts: HouseholdDebt[];
};

export type ExpenseSplitDraft =
  | { type: 'equal'; memberIds: string[] }
  | { type: 'custom'; shares: Array<{ userId: string; amount: string }> }
  | { type: 'percentage'; shares: Array<{ userId: string; percentage: number }> };
