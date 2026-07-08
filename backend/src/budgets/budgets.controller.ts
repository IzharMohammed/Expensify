import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../auth/zod-validation.pipe';
import { BudgetsService } from './budgets.service';
import { UpsertBudgetDto, upsertBudgetSchema } from './dto/upsert-budget.dto';
import { UpsertIncomeDto, upsertIncomeSchema } from './dto/upsert-income.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  async upsertBudget(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(upsertBudgetSchema)) body: UpsertBudgetDto,
  ) {
    return this.budgetsService.upsertBudget(user.sub, body);
  }

  @Post('income')
  async upsertIncome(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(upsertIncomeSchema)) body: UpsertIncomeDto,
  ) {
    return this.budgetsService.upsertIncome(user.sub, body);
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query('month') month?: string) {
    const effectiveMonth = month ?? new Date().toISOString().slice(0, 7);
    return this.budgetsService.listMonth(user.sub, effectiveMonth);
  }
}
