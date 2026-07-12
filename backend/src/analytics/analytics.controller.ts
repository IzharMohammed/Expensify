import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../auth/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';
import {
  MonthQueryDto,
  SpendingRangeDto,
  YearQueryDto,
  monthQuerySchema,
  spendingRangeSchema,
  yearQuerySchema,
} from './dto/analytics-range.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('spending')
  async spending(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(spendingRangeSchema)) query: SpendingRangeDto,
  ) {
    return this.analyticsService.getSpending(user.sub, query.range);
  }

  @Get('category-distribution')
  async categoryDistribution(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQueryDto,
  ) {
    return this.analyticsService.getCategoryDistribution(user.sub, query.month);
  }

  @Get('heatmap')
  async heatmap(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(yearQuerySchema)) query: YearQueryDto,
  ) {
    return this.analyticsService.getHeatmap(user.sub, query.year);
  }

  @Get('savings-trend')
  async savingsTrend(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getSavingsTrend(user.sub);
  }

  @Get('networth-trend')
  async networthTrend(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getNetworthTrend(user.sub);
  }
}
