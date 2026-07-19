export type StreakSummary = {
  currentStreak: number;
  longestStreak: number;
  lastQualifyingDate: string | null;
  rule: string;
  timeZone: string;
};

export type BadgeRecord = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
};

export type BadgeAward = Omit<BadgeRecord, 'earned'> & { earnedAt: string };
