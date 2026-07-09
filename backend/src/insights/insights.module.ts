import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { UsersService } from '../users/users.service';
import { InsightsController } from './insights.controller';
import { InsightsAiService } from './insights-ai.service';
import { InsightsService } from './insights.service';

@Module({
  imports: [BudgetsModule],
  controllers: [InsightsController],
  providers: [InsightsService, InsightsAiService, UsersService],
  exports: [InsightsService],
})
export class InsightsModule {}
