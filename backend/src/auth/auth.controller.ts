import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto, loginSchema } from './dto/login.dto';
import { LogoutDto, logoutSchema } from './dto/logout.dto';
import { RefreshDto, refreshSchema } from './dto/refresh.dto';
import { RegisterDto, registerSchema } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ZodValidationPipe } from './zod-validation.pipe';

type GoogleRequestUser = {
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: 'google';
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(body);
    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: result.user,
    };
  }

  @Post('login')
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 5 } })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body);
    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: result.user,
    };
  }

  @Post('refresh')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  async refresh(
    @Req() req: Request,
    @Body() body: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.extractRefreshToken(req, body.refreshToken);
    const result = await this.authService.refresh(refreshToken || "");
    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: result.user,
    };
  }

  @Post('logout')
  @UsePipes(new ZodValidationPipe(logoutSchema))
  async logout(
    @Req() req: Request,
    @Body() body: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.extractRefreshToken(req, body.refreshToken, false);
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions());
    return { success: true };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    return undefined;
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    if (!req.user) {
      throw new UnauthorizedException('Google authentication failed');
    }

    const result = await this.authService.loginWithGoogle(req.user as GoogleRequestUser);
    this.setRefreshCookie(res, result.refreshToken);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return res.redirect(new URL('/auth/callback', frontendUrl).toString());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    return { user };
  }

  private extractRefreshToken(
    req: Request,
    bodyToken?: string,
    required = true,
  ): string | undefined {
    const cookieToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    const refreshToken = cookieToken ?? bodyToken;

    if (!refreshToken && required) {
      throw new UnauthorizedException('Missing refresh token');
    }

    return refreshToken;
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.cookieOptions(),
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get('NODE_ENV') === 'production',
      path: '/',
    };
  }
}
