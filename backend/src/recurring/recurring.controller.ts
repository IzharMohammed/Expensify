import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RecurringService } from './recurring.service';

@Controller('recurring')
@UseGuards(JwtAuthGuard)
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.recurringService.list(user.sub);
  }

  @Post(':id/confirm')
  async confirm(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.recurringService.confirm(user.sub, id);
  }

  @Post(':id/reject')
  async reject(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.recurringService.reject(user.sub, id);
  }
}
