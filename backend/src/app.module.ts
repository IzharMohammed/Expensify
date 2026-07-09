import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { DrizzleModule } from './database/drizzle.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExpensesModule } from './expenses/expenses.module';
import { InsightsModule } from './insights/insights.module';
import { InsightsQueueService } from './queues/insights-queue.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 20,
      },
    ]),
    DrizzleModule,
    AuthModule,
    CategoriesModule,
    BudgetsModule,
    DashboardModule,
    ExpensesModule,
    InsightsModule,
  ],
  providers: [InsightsQueueService],
})
export class AppModule {}
