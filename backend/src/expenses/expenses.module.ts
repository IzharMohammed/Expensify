import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { CategoriesModule } from '../categories/categories.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { StorageService } from '../storage/storage.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { GroqService } from './groq.service';

@Module({
  imports: [CategoriesModule, BudgetsModule, DashboardModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, GroqService, StorageService],
})
export class ExpensesModule {}
