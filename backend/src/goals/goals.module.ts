import { Module } from '@nestjs/common';
import { GoalsAiService } from './goals-ai.service';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  controllers: [GoalsController],
  providers: [GoalsService, GoalsAiService],
})
export class GoalsModule {}
