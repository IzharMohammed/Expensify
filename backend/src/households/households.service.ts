import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import {
  expenseSplits,
  expenses,
  householdMembers,
  households,
  settlements,
  users,
} from '../database/schema';
import { CreateHouseholdDto, CreateSettlementDto } from './dto/household.dto';

type InvitePayload = { householdId: string; expiresAt: number };

@Injectable()
export class HouseholdsService {
  private readonly inviteSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly drizzle: DrizzleService,
    config: ConfigService,
  ) {
    this.inviteSecret = config.getOrThrow<string>('JWT_SECRET');
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async create(userId: string, dto: CreateHouseholdDto) {
    const household = await this.drizzle.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(households)
        .values({ name: dto.name, ownerId: userId })
        .returning();
      await tx.insert(householdMembers).values({
        householdId: created.id,
        userId,
        role: 'owner',
      });
      return created;
    });

    return this.get(userId, household.id);
  }

  async list(userId: string) {
    const memberships = await this.drizzle.db
      .select({ household: households, role: householdMembers.role })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(eq(householdMembers.userId, userId));

    return Promise.all(
      memberships.map(async ({ household, role }) => ({
        ...household,
        role,
        members: await this.getMembers(household.id),
      })),
    );
  }

  async get(userId: string, householdId: string) {
    const membership = await this.requireMember(userId, householdId);
    const [household] = await this.drizzle.db
      .select()
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);

    if (!household) throw new NotFoundException('Household not found');
    return { ...household, role: membership.role, members: await this.getMembers(householdId) };
  }

  async createInvite(userId: string, householdId: string) {
    const membership = await this.requireMember(userId, householdId);
    if (membership.role !== 'owner') {
      throw new ForbiddenException('Only the household owner can invite members');
    }

    const payload: InvitePayload = {
      householdId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(encoded);
    const code = `${encoded}.${signature}`;
    return {
      code,
      expiresAt: new Date(payload.expiresAt).toISOString(),
      inviteUrl: `${this.frontendUrl}/households/${householdId}/join?code=${encodeURIComponent(code)}`,
    };
  }

  async join(userId: string, householdId: string, code: string) {
    const payload = this.verifyInvite(code);
    if (payload.householdId !== householdId) throw new BadRequestException('Invite is invalid');

    const [household] = await this.drizzle.db
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);
    if (!household) throw new NotFoundException('Household not found');

    await this.drizzle.db
      .insert(householdMembers)
      .values({ householdId, userId, role: 'member' })
      .onConflictDoNothing();
    return this.get(userId, householdId);
  }

  async getBalances(userId: string, householdId: string) {
    await this.requireMember(userId, householdId);
    const members = await this.getMembers(householdId);
    const memberIds = members.map((member) => member.userId);
    const net = new Map(memberIds.map((id) => [id, 0]));

    const householdExpenses = await this.drizzle.db
      .select({ id: expenses.id, paidBy: expenses.userId, amount: expenses.amount })
      .from(expenses)
      .where(eq(expenses.householdId, householdId));
    const expenseIds = householdExpenses.map((expense) => expense.id);
    const splits = expenseIds.length
      ? await this.drizzle.db
          .select()
          .from(expenseSplits)
          .where(inArray(expenseSplits.expenseId, expenseIds))
      : [];

    for (const expense of householdExpenses) {
      net.set(expense.paidBy, (net.get(expense.paidBy) ?? 0) + this.toCents(expense.amount));
    }
    for (const split of splits) {
      net.set(split.userId, (net.get(split.userId) ?? 0) - this.toCents(split.amount));
    }

    const settledRows = await this.drizzle.db
      .select()
      .from(settlements)
      .where(and(eq(settlements.householdId, householdId), eq(settlements.status, 'settled')));
    for (const settlement of settledRows) {
      const amount = this.toCents(settlement.amount);
      net.set(settlement.fromUserId, (net.get(settlement.fromUserId) ?? 0) + amount);
      net.set(settlement.toUserId, (net.get(settlement.toUserId) ?? 0) - amount);
    }

    const debtors = [...net.entries()]
      .filter(([, amount]) => amount < 0)
      .map(([id, amount]) => ({ id, amount: -amount }))
      .sort((a, b) => b.amount - a.amount);
    const creditors = [...net.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);
    const debts: Array<{ fromUserId: string; toUserId: string; amount: string }> = [];

    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.amount, creditor.amount);
      if (amount > 0) {
        debts.push({
          fromUserId: debtor.id,
          toUserId: creditor.id,
          amount: (amount / 100).toFixed(2),
        });
      }
      debtor.amount -= amount;
      creditor.amount -= amount;
      if (debtor.amount === 0) debtorIndex += 1;
      if (creditor.amount === 0) creditorIndex += 1;
    }

    return { currentUserId: userId, members, debts };
  }

  async settle(userId: string, dto: CreateSettlementDto) {
    const membership = await this.requireMember(userId, dto.householdId);
    if (userId !== dto.fromUserId && membership.role !== 'owner') {
      throw new ForbiddenException('Only the payer or household owner can settle this debt');
    }

    const memberRows = await this.drizzle.db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, dto.householdId),
          inArray(householdMembers.userId, [dto.fromUserId, dto.toUserId]),
        ),
      );
    if (memberRows.length !== 2) throw new BadRequestException('Settlement users are invalid');

    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Invalid amount');
    const balances = await this.getBalances(userId, dto.householdId);
    const debt = balances.debts.find(
      (item) => item.fromUserId === dto.fromUserId && item.toUserId === dto.toUserId,
    );
    if (!debt) throw new BadRequestException('This debt is no longer outstanding');
    if (this.toCents(amount) > this.toCents(debt.amount)) {
      throw new BadRequestException('Settlement cannot exceed the outstanding debt');
    }
    const [settlement] = await this.drizzle.db
      .insert(settlements)
      .values({ ...dto, amount: amount.toFixed(2), status: 'settled' })
      .returning();
    return settlement;
  }

  async requireMember(userId: string, householdId: string) {
    const [membership] = await this.drizzle.db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!membership) throw new ForbiddenException('You are not a member of this household');
    return membership;
  }

  private async getMembers(householdId: string) {
    return this.drizzle.db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
      })
      .from(householdMembers)
      .innerJoin(users, eq(users.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, householdId));
  }

  private verifyInvite(code: string): InvitePayload {
    const [encoded, signature] = code.split('.');
    if (!encoded || !signature) throw new BadRequestException('Invite is invalid');
    const expected = this.sign(encoded);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new BadRequestException('Invite is invalid');
    }
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as InvitePayload;
      if (!payload.householdId || payload.expiresAt <= Date.now()) {
        throw new BadRequestException('Invite has expired');
      }
      return payload;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invite is invalid');
    }
  }

  private sign(value: string) {
    return createHmac('sha256', this.inviteSecret).update(value).digest('base64url');
  }

  private toCents(value: string | number) {
    return Math.round(Number(value) * 100);
  }
}
