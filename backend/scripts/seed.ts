import 'dotenv/config';

import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  budgets,
  categories,
  expenses,
  goals,
  recurringExpenses,
  users,
} from '../src/database/schema';

const DEFAULT_USER_COUNT = 10_000;
const MIN_EXPENSES_PER_USER = 200;
const MAX_EXPENSES_PER_USER = 500;
const INSERT_BATCH_SIZE = 3_000;
const USER_BATCH_SIZE = 1_000;
const PROGRESS_INTERVAL = 50_000;
const SEED_PASSWORD = 'Test1234!';

type CategoryName =
  | 'Food'
  | 'Rent'
  | 'Shopping'
  | 'Petrol'
  | 'EMI'
  | 'Investment'
  | 'Entertainment'
  | 'Grocery'
  | 'Medical'
  | 'Travel'
  | 'Education';

type ExpenseTemplate = {
  weight: number;
  merchants: readonly string[];
  min: number;
  max: number;
};

const EXPENSE_TEMPLATES: Record<Exclude<CategoryName, 'Rent'>, ExpenseTemplate> = {
  Food: {
    weight: 30,
    merchants: [
      'Swiggy',
      'Zomato',
      "McDonald's",
      'Dominos',
      'Haldirams',
      'Cafe Coffee Day',
      'Local Restaurant',
      'Office Canteen',
    ],
    min: 100,
    max: 800,
  },
  Grocery: {
    weight: 18,
    merchants: ['BigBasket', 'Blinkit', 'Zepto', 'DMart', 'Reliance Fresh', 'Local Kirana'],
    min: 150,
    max: 3_500,
  },
  Shopping: {
    weight: 14,
    merchants: ['Amazon India', 'Flipkart', 'Myntra', 'Ajio', 'Westside', 'Lifestyle'],
    min: 200,
    max: 5_000,
  },
  Petrol: {
    weight: 10,
    merchants: ['IndianOil', 'Bharat Petroleum', 'HP Petrol Pump', 'Shell'],
    min: 500,
    max: 3_500,
  },
  Entertainment: {
    weight: 8,
    merchants: ['BookMyShow', 'PVR INOX', 'Netflix', 'Spotify', 'YouTube Premium'],
    min: 149,
    max: 1_500,
  },
  Travel: {
    weight: 7,
    merchants: ['Uber', 'Ola', 'Rapido', 'IRCTC', 'MakeMyTrip', 'IndiGo'],
    min: 80,
    max: 8_000,
  },
  Medical: {
    weight: 5,
    merchants: ['Apollo Pharmacy', 'Tata 1mg', 'Practo', 'Local Pharmacy', 'Pathkind Labs'],
    min: 150,
    max: 4_000,
  },
  EMI: {
    weight: 3,
    merchants: ['HDFC Bank EMI', 'ICICI Bank EMI', 'Bajaj Finserv', 'SBI Loan'],
    min: 2_000,
    max: 18_000,
  },
  Investment: {
    weight: 3,
    merchants: ['Zerodha SIP', 'Groww Mutual Fund', 'PPF Deposit', 'NPS Contribution'],
    min: 500,
    max: 10_000,
  },
  Education: {
    weight: 2,
    merchants: ['Udemy', 'Coursera', 'Unacademy', 'Crossword Books', 'School Fees'],
    min: 250,
    max: 12_000,
  },
};

const RENT_MERCHANTS = ['Monthly Rent', 'Apartment Rent', 'House Rent', 'PG Rent'] as const;
const SOURCES = ['manual', 'text', 'voice', 'ocr'] as const;
const GOAL_NAMES = [
  'Emergency fund',
  'Dream vacation',
  'New car',
  'Home down payment',
  'New laptop',
  'Higher education',
  'Wedding fund',
] as const;

function readPositiveIntegerFlag(name: string): number | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  if (!argument) return undefined;

  const parsed = Number(argument.slice(prefix.length));
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function weightedChoice<T>(choices: readonly { value: T; weight: number }[]): T {
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let cursor = faker.number.float({ min: 0, max: totalWeight });
  for (const choice of choices) {
    cursor -= choice.weight;
    if (cursor <= 0) return choice.value;
  }
  return choices[choices.length - 1].value;
}

function weightedSpendingDate(now: Date): Date {
  const earliest = new Date(now);
  earliest.setUTCFullYear(earliest.getUTCFullYear() - 1);

  // Rejection sampling keeps the full year available while making weekends and
  // salary/billing-cycle edges materially more likely than ordinary weekdays.
  for (;;) {
    const candidate = faker.date.between({ from: earliest, to: now });
    const dayOfWeek = candidate.getUTCDay();
    const dayOfMonth = candidate.getUTCDate();
    let acceptance = 0.34;
    if (dayOfWeek === 0 || dayOfWeek === 6) acceptance += 0.34;
    if (dayOfMonth <= 4 || dayOfMonth >= 27) acceptance += 0.24;
    if (faker.number.float({ min: 0, max: 1 }) <= acceptance) return candidate;
  }
}

function rentDate(monthsAgo: number, now: Date): Date {
  const date = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - monthsAgo,
      faker.number.int({ min: 1, max: 5 }),
      faker.number.int({ min: 7, max: 11 }),
      faker.number.int({ min: 0, max: 59 }),
    ),
  );
  return date > now ? new Date(now) : date;
}

function money(min: number, max: number): string {
  return faker.number.float({ min, max, fractionDigits: 2 }).toFixed(2);
}

function randomExpenseCount(): number {
  // This distribution averages about 285 rows/user (roughly 2.85M at the
  // default scale) while retaining realistic heavy spenders up to 500 rows.
  const range = weightedChoice([
    { value: [200, 300] as const, weight: 60 },
    { value: [301, 400] as const, weight: 30 },
    { value: [401, 500] as const, weight: 10 },
  ]);
  return faker.number.int({ min: range[0], max: range[1] });
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const userCount = readPositiveIntegerFlag('users') ?? DEFAULT_USER_COUNT;
  const fixedExpensesPerUser = readPositiveIntegerFlag('expenses-per-user');
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const startedAt = Date.now();
  const now = new Date();

  try {
    const categoryRows = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.isDefault, true));
    const categoryIds = new Map(categoryRows.map((category) => [category.name, category.id]));
    const missingCategories = (Object.keys({ ...EXPENSE_TEMPLATES, Rent: true }) as CategoryName[])
      .filter((name) => !categoryIds.has(name));
    if (missingCategories.length > 0) {
      throw new Error(
        `Missing default categories: ${missingCategories.join(', ')}. Run Drizzle migrations first.`,
      );
    }

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
    const seededUsers: Array<{ id: string }> = [];

    console.log(`Seeding ${userCount.toLocaleString()} users...`);
    for (let offset = 0; offset < userCount; offset += USER_BATCH_SIZE) {
      const size = Math.min(USER_BATCH_SIZE, userCount - offset);
      const values = Array.from({ length: size }, (_, index) => {
        const ordinal = offset + index + 1;
        return {
          email: `seed.user${String(ordinal).padStart(6, '0')}@seed.expensify.test`,
          passwordHash,
          name: faker.person.fullName(),
          authProvider: 'local' as const,
          createdAt: faker.date.between({
            from: new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), 1)),
            to: now,
          }),
        };
      });

      const inserted = await db.transaction((tx) =>
        tx.insert(users).values(values).returning({ id: users.id }),
      );
      seededUsers.push(...inserted);
      console.log(`  users: ${seededUsers.length.toLocaleString()}/${userCount.toLocaleString()}`);
    }

    type NewExpense = typeof expenses.$inferInsert;
    type NewBudget = typeof budgets.$inferInsert;
    type NewRecurringExpense = typeof recurringExpenses.$inferInsert;
    type NewGoal = typeof goals.$inferInsert;

    let expenseBuffer: NewExpense[] = [];
    let budgetBuffer: NewBudget[] = [];
    let recurringBuffer: NewRecurringExpense[] = [];
    let goalBuffer: NewGoal[] = [];
    let insertedExpenses = 0;
    let nextProgressLog = PROGRESS_INTERVAL;

    const flushExpenses = async (): Promise<void> => {
      if (expenseBuffer.length === 0) return;
      const batch = expenseBuffer;
      expenseBuffer = [];
      await db.transaction((tx) => tx.insert(expenses).values(batch));
      insertedExpenses += batch.length;
      if (insertedExpenses >= nextProgressLog) {
        console.log(`  expenses: ${insertedExpenses.toLocaleString()} inserted`);
        while (nextProgressLog <= insertedExpenses) nextProgressLog += PROGRESS_INTERVAL;
      }
    };
    const flushSupportingRows = async (force = false): Promise<void> => {
      if (force || budgetBuffer.length >= INSERT_BATCH_SIZE) {
        const batch = budgetBuffer;
        budgetBuffer = [];
        if (batch.length) await db.transaction((tx) => tx.insert(budgets).values(batch));
      }
      if (force || recurringBuffer.length >= INSERT_BATCH_SIZE) {
        const batch = recurringBuffer;
        recurringBuffer = [];
        if (batch.length) {
          await db.transaction((tx) => tx.insert(recurringExpenses).values(batch));
        }
      }
      if (force || goalBuffer.length >= INSERT_BATCH_SIZE) {
        const batch = goalBuffer;
        goalBuffer = [];
        if (batch.length) await db.transaction((tx) => tx.insert(goals).values(batch));
      }
    };

    const weightedCategories = Object.entries(EXPENSE_TEMPLATES).map(([value, template]) => ({
      value: value as Exclude<CategoryName, 'Rent'>,
      weight: template.weight,
    }));
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    console.log('Generating and inserting expense data...');
    for (const user of seededUsers) {
      const expenseCount =
        fixedExpensesPerUser ?? randomExpenseCount();
      const rentMonths = Math.min(expenseCount, faker.datatype.boolean({ probability: 0.82 }) ? 12 : 0);

      for (let month = 0; month < rentMonths; month += 1) {
        expenseBuffer.push({
          userId: user.id,
          amount: money(8_000, 25_000),
          merchant: faker.helpers.arrayElement(RENT_MERCHANTS),
          categoryId: categoryIds.get('Rent')!,
          paymentMethod: 'netbanking',
          date: rentDate(month, now),
          note: 'Monthly rent',
          source: 'manual',
        });
        if (expenseBuffer.length >= INSERT_BATCH_SIZE) await flushExpenses();
      }

      for (let index = rentMonths; index < expenseCount; index += 1) {
        const category = weightedChoice(weightedCategories);
        const template = EXPENSE_TEMPLATES[category];
        expenseBuffer.push({
          userId: user.id,
          amount: money(template.min, template.max),
          merchant: faker.helpers.arrayElement(template.merchants),
          categoryId: categoryIds.get(category)!,
          paymentMethod: weightedChoice([
            { value: 'upi' as const, weight: 55 },
            { value: 'card' as const, weight: 25 },
            { value: 'cash' as const, weight: 15 },
            { value: 'netbanking' as const, weight: 5 },
          ]),
          date: weightedSpendingDate(now),
          source: weightedChoice([
            { value: SOURCES[0], weight: 65 },
            { value: SOURCES[1], weight: 18 },
            { value: SOURCES[2], weight: 7 },
            { value: SOURCES[3], weight: 10 },
          ]),
        });

        if (expenseBuffer.length >= INSERT_BATCH_SIZE) await flushExpenses();
      }

      if (faker.datatype.boolean({ probability: 0.65 })) {
        const budgetCategories = faker.helpers.arrayElements(
          ['Food', 'Grocery', 'Shopping', 'Entertainment', 'Travel'] as CategoryName[],
          { min: 2, max: 4 },
        );
        for (const category of budgetCategories) {
          const limits: Record<string, [number, number]> = {
            Food: [4_000, 12_000],
            Grocery: [5_000, 15_000],
            Shopping: [3_000, 15_000],
            Entertainment: [1_000, 5_000],
            Travel: [2_000, 12_000],
          };
          budgetBuffer.push({
            userId: user.id,
            categoryId: categoryIds.get(category)!,
            amount: money(...limits[category]),
            month: currentMonth,
          });
        }
      }

      const recurringCount = faker.number.int({ min: 1, max: 4 });
      for (let index = 0; index < recurringCount; index += 1) {
        const recurring = faker.helpers.arrayElement([
          { merchant: 'Netflix', category: 'Entertainment' as const, min: 149, max: 649 },
          { merchant: 'Spotify', category: 'Entertainment' as const, min: 119, max: 179 },
          { merchant: 'Jio Recharge', category: 'Entertainment' as const, min: 299, max: 999 },
          { merchant: 'Gym Membership', category: 'Medical' as const, min: 800, max: 2_500 },
          { merchant: 'House Rent', category: 'Rent' as const, min: 8_000, max: 25_000 },
          { merchant: 'SIP Investment', category: 'Investment' as const, min: 1_000, max: 10_000 },
        ]);
        recurringBuffer.push({
          userId: user.id,
          merchant: recurring.merchant,
          amount: money(recurring.min, recurring.max),
          categoryId: categoryIds.get(recurring.category)!,
          frequency: 'monthly',
          nextDueDate: faker.date.soon({ days: 30, refDate: now }),
          isAutoDetected: faker.datatype.boolean({ probability: 0.7 }),
          isConfirmed: faker.datatype.boolean({ probability: 0.8 }),
        });
      }

      const goalCount = faker.number.int({ min: 1, max: 3 });
      for (let index = 0; index < goalCount; index += 1) {
        const target = faker.number.int({ min: 25_000, max: 1_500_000 });
        goalBuffer.push({
          userId: user.id,
          name: faker.helpers.arrayElement(GOAL_NAMES),
          targetAmount: target.toFixed(2),
          currentAmount: faker.number
            .float({ min: 0, max: target * 0.75, fractionDigits: 2 })
            .toFixed(2),
          targetDate: faker.date.future({ years: 3, refDate: now }),
        });
      }

      await flushSupportingRows();
    }

    await flushExpenses();
    await flushSupportingRows(true);
    const elapsedSeconds = ((Date.now() - startedAt) / 1_000).toFixed(1);
    console.log(
      `Seed complete: ${userCount.toLocaleString()} users and ` +
        `${insertedExpenses.toLocaleString()} expenses in ${elapsedSeconds}s.`,
    );
    console.log(`Login: seed.user000001@seed.expensify.test / ${SEED_PASSWORD}`);
  } catch (error) {
    if (
      error instanceof Error &&
      /duplicate key value|unique constraint/i.test(error.message)
    ) {
      console.error('Seed users already exist. Run scripts/reset-seed.ts before reseeding.');
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
