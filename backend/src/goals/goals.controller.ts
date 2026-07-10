import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../auth/zod-validation.pipe';
import { ContributeGoalDto, contributeGoalSchema } from './dto/contribute-goal.dto';
import { CreateGoalDto, createGoalSchema } from './dto/create-goal.dto';
import { UpdateGoalDto, updateGoalSchema } from './dto/update-goal.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.goalsService.list(user.sub);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createGoalSchema)) body: CreateGoalDto,
  ) {
    return this.goalsService.create(user.sub, body);
  }

  @Get(':id')
  async getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.getById(user.sub, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGoalSchema)) body: UpdateGoalDto,
  ) {
    return this.goalsService.update(user.sub, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.remove(user.sub, id);
  }

  @Post(':id/contribute')
  async contribute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(contributeGoalSchema)) body: ContributeGoalDto,
  ) {
    return this.goalsService.contribute(user.sub, id, body);
  }

  @Get(':id/insight')
  async insight(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.getInsight(user.sub, id);
  }
}
