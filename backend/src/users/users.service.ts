import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { NewUser, User, users } from '../database/schema';

@Injectable()
export class UsersService {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.drizzle.db.select().from(users).where(eq(users.email, email));
    return user ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.drizzle.db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  async create(data: NewUser): Promise<User> {
    const [user] = await this.drizzle.db.insert(users).values(data).returning();
    return user;
  }

  async listAll(): Promise<User[]> {
    return this.drizzle.db.select().from(users).orderBy(asc(users.createdAt));
  }
}
