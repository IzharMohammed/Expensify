import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { Category, categories } from '../database/schema';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly drizzle: DrizzleService) {}

  async listForUser(userId: string): Promise<Category[]> {
    return this.drizzle.db
      .select()
      .from(categories)
      .where(or(isNull(categories.userId), eq(categories.userId, userId)))
      .orderBy(desc(categories.isDefault), asc(categories.name));
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const normalizedName = dto.name.trim();
    const existing = await this.findByNameForUser(userId, normalizedName);
    if (existing) {
      throw new BadRequestException('Category with this name already exists');
    }

    const [category] = await this.drizzle.db
      .insert(categories)
      .values({
        userId,
        name: normalizedName,
        icon: dto.icon,
        color: dto.color,
        isDefault: false,
      })
      .returning();

    return category;
  }

  async delete(userId: string, categoryId: string) {
    const [category] = await this.drizzle.db.select().from(categories).where(eq(categories.id, categoryId));

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.isDefault || category.userId === null) {
      throw new BadRequestException('Default categories cannot be deleted');
    }

    if (category.userId !== userId) {
      throw new NotFoundException('Category not found');
    }

    await this.drizzle.db.delete(categories).where(eq(categories.id, categoryId));
    return { success: true };
  }

  async findAccessibleById(userId: string, categoryId: string): Promise<Category | null> {
    const [category] = await this.drizzle.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          or(isNull(categories.userId), eq(categories.userId, userId)),
        ),
      );

    return category ?? null;
  }

  async findByNameForUser(userId: string, categoryName: string): Promise<Category | null> {
    const normalizedName = categoryName.trim().toLowerCase();
    const categoryList = await this.listForUser(userId);
    return (
      categoryList.find((category) => category.name.trim().toLowerCase() === normalizedName) ??
      null
    );
  }
}
