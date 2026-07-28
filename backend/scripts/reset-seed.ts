import 'dotenv/config';

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { categories } from '../src/database/schema';

const DEFAULT_CATEGORIES = [
  ['Food', 'UtensilsCrossed', '#F97316'],
  ['Rent', 'Home', '#0F766E'],
  ['Shopping', 'ShoppingBag', '#7C3AED'],
  ['Petrol', 'Fuel', '#DC2626'],
  ['EMI', 'ReceiptIndianRupee', '#2563EB'],
  ['Investment', 'TrendingUp', '#15803D'],
  ['Entertainment', 'Film', '#DB2777'],
  ['Grocery', 'ShoppingCart', '#65A30D'],
  ['Medical', 'Cross', '#0891B2'],
  ['Travel', 'Plane', '#D97706'],
  ['Education', 'GraduationCap', '#4F46E5'],
] as const;

async function confirmReset(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset seed data while NODE_ENV=production');
  }
  if (process.env.NODE_ENV === 'development') return;

  const readline = createInterface({ input: stdin, output: stdout });
  try {
    console.warn(
      `WARNING: NODE_ENV is "${process.env.NODE_ENV ?? 'unset'}". ` +
        'This permanently removes all application users and their data.',
    );
    const answer = await readline.question('Type RESET to continue: ');
    if (answer !== 'RESET') throw new Error('Reset cancelled');
  } finally {
    readline.close();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  await confirmReset();

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    await db.transaction(async (tx) => {
      // CASCADE clears every user-owned/dependent table, including seed expenses,
      // budgets, recurring expenses, goals, tokens, and related join tables.
      await tx.execute(sql.raw('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE'));

      // categories references users, so PostgreSQL also truncates it. Restore the
      // migration-provided global categories needed by both the app and seed script.
      await tx.insert(categories).values(
        DEFAULT_CATEGORIES.map(([name, icon, color]) => ({
          name,
          icon,
          color,
          isDefault: true,
        })),
      );
    });
    console.log('Seed tables reset; global default categories restored.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Reset failed:', error);
  process.exitCode = 1;
});
