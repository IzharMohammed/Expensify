import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { CategoriesModule } from '../categories/categories.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { GroqService } from './groq.service';

@Module({
  imports: [
    CategoriesModule,
    BudgetsModule,
    DashboardModule,
    HouseholdsModule,
    NotificationsModule,
    StorageModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, GroqService],
})
export class ExpensesModule {}
