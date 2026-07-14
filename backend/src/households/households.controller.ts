import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../auth/zod-validation.pipe';
import {
  CreateHouseholdDto,
  CreateSettlementDto,
  JoinHouseholdDto,
  createHouseholdSchema,
  createSettlementSchema,
  joinHouseholdSchema,
} from './dto/household.dto';
import { HouseholdsService } from './households.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get('households')
  async list(@CurrentUser() user: JwtPayload) {
    return { households: await this.households.list(user.sub) };
  }

  @Post('households')
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createHouseholdSchema)) body: CreateHouseholdDto,
  ) {
    return { household: await this.households.create(user.sub, body) };
  }

  @Get('households/:id')
  async get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return { household: await this.households.get(user.sub, id) };
  }

  @Post('households/:id/invite')
  async invite(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.households.createInvite(user.sub, id);
  }

  @Post('households/:id/join')
  async join(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(joinHouseholdSchema)) body: JoinHouseholdDto,
  ) {
    return { household: await this.households.join(user.sub, id, body.code) };
  }

  @Get('households/:id/balances')
  async balances(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.households.getBalances(user.sub, id);
  }

  @Post('settlements')
  async settle(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createSettlementSchema)) body: CreateSettlementDto,
  ) {
    return { settlement: await this.households.settle(user.sub, body) };
  }
}
