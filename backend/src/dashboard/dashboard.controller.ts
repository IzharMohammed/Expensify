import { Controller, Get, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DashboardEventsService } from './dashboard-events.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dashboardEventsService: DashboardEventsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async summary(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getSummary(user.sub);
  }

  @Get('stream')
  async stream(@Req() req: Request, @Res() res: Response, @Query('token') token?: string) {
    const userId = this.resolveUserId(req, token);
    const initialSummary = await this.dashboardService.getSummary(userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    this.writeEvent(res, 'summary', initialSummary);

    const unsubscribe = await this.dashboardEventsService.subscribe(userId, (event) => {
      this.writeEvent(res, event.type, event.data);
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    req.on('close', async () => {
      clearInterval(heartbeat);
      await unsubscribe();
      res.end();
    });
  }

  private resolveUserId(req: Request, token?: string) {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const candidate = token ?? bearer;

    if (!candidate) {
      throw new UnauthorizedException('Missing access token');
    }

    const payload = this.jwtService.verify<JwtPayload>(candidate, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
    });
    return payload.sub;
  }

  private writeEvent(res: Response, event: string, data: unknown) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
