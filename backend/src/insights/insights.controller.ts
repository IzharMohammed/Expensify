import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../auth/zod-validation.pipe';
import { HistoryQueryDto, historyQuerySchema } from './dto/history-query.dto';
import { InsightsService } from './insights.service';

@Controller('insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('date') date?: string,
    @Query('month') month?: string,
  ) {
    if (month) {
      return {
        insights: await this.insightsService.getByMonth(user.sub, month),
      };
    }

    return {
      insights: await this.insightsService.getToday(user.sub, date),
    };
  }

  @Get('latest')
  async latest(@CurrentUser() user: JwtPayload) {
    return {
      insights: await this.insightsService.getLatest(user.sub),
    };
  }

  @Get('history')
  async history(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(historyQuerySchema)) query: HistoryQueryDto,
  ) {
    return this.insightsService.getHistory(user.sub, query.page, query.limit);
  }
}
