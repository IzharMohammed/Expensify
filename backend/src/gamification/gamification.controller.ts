import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { GamificationService } from './gamification.service';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('streak')
  async streak(@CurrentUser() user: JwtPayload) {
    return this.gamification.getStreak(user.sub);
  }

  @Get('badges')
  async badges(@CurrentUser() user: JwtPayload) {
    return this.gamification.getBadges(user.sub);
  }
}