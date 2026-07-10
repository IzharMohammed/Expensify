import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { DrizzleModule } from './database/drizzle.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExpensesModule } from './expenses/expenses.module';
import { GoalsModule } from './goals/goals.module';
import { InsightsModule } from './insights/insights.module';
import { InsightsQueueService } from './queues/insights-queue.service';
import { QueueBoardService } from './queues/queue-board.service';

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
    ChatModule,
    CategoriesModule,
    BudgetsModule,
    DashboardModule,
    ExpensesModule,
    GoalsModule,
    InsightsModule,
  ],
  providers: [InsightsQueueService, QueueBoardService],
})
export class AppModule {}
