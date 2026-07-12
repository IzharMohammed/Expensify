import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { DrizzleModule } from './database/drizzle.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExpensesModule } from './expenses/expenses.module';
import { GoalsModule } from './goals/goals.module';
import { InsightsModule } from './insights/insights.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InsightsQueueService } from './queues/insights-queue.service';
import { NotificationsQueueService } from './queues/notifications-queue.service';
import { QueueBoardService } from './queues/queue-board.service';
import { RecurringQueueService } from './queues/recurring-queue.service';
import { RecurringModule } from './recurring/recurring.module';

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
    BullBoardModule.forRoot({
      route: process.env.BULL_BOARD_ROUTE ?? '/admin/queues',
      adapter: ExpressAdapter,
    }),
    DrizzleModule,
    AuthModule,
    AnalyticsModule,
    ChatModule,
    CategoriesModule,
    BudgetsModule,
    DashboardModule,
    ExpensesModule,
    GoalsModule,
    InsightsModule,
    NotificationsModule,
    RecurringModule,
  ],
  providers: [InsightsQueueService, NotificationsQueueService, RecurringQueueService, QueueBoardService],
})
export class AppModule {}
