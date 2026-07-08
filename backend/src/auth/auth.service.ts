import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { and, eq, gt } from 'drizzle-orm';
import { randomUUID, createHash } from 'crypto';
import { DrizzleService } from '../database/drizzle.service';
import { refreshTokens, User } from '../database/schema';
import { UsersService } from '../users/users.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: 'local' | 'google';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly drizzle: DrizzleService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      authProvider: 'local',
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async loginWithGoogle(profile: {
    email?: string;
    name: string;
    avatarUrl: string | null;
    authProvider: 'google';
  }) {
    if (!profile.email) {
      throw new UnauthorizedException('Google account did not return an email');
    }

    const existingUser = await this.usersService.findByEmail(profile.email);
    const user =
      existingUser ??
      (await this.usersService.create({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        authProvider: 'google',
        passwordHash: null,
      }));

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const hashedToken = this.hashToken(refreshToken);

    const [storedToken] = await this.drizzle.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.id, payload.jti),
          eq(refreshTokens.tokenHash, hashedToken),
          eq(refreshTokens.revoked, false),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      );

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.revokeRefreshToken(storedToken.id);
    return this.issueTokens(user);
  }

  async logout(refreshToken: string) {
    const hashedToken = this.hashToken(refreshToken);
    const [storedToken] = await this.drizzle.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashedToken));

    if (storedToken) {
      await this.revokeRefreshToken(storedToken.id);
    }

    return { success: true };
  }

  private async issueTokens(user: User) {
    const authUser = this.toAuthUser(user);
    const jwtPayload = this.toJwtPayload(user);
    const accessToken = await this.jwtService.signAsync(jwtPayload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      subject: user.id,
    });

    const tokenId = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { type: 'refresh' },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
        subject: user.id,
        jwtid: tokenId,
      },
    );

    await this.drizzle.db.insert(refreshTokens).values({
      id: tokenId,
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      revoked: false,
    });

    return {
      accessToken,
      refreshToken,
      user: authUser,
    };
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<{
        sub: string;
        jti: string;
        type: 'refresh';
      }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid');
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeRefreshToken(tokenId: string) {
    await this.drizzle.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, tokenId));
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      authProvider: user.authProvider,
    };
  }

  private toJwtPayload(user: User): Omit<JwtPayload, 'sub'> {
    return {
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      authProvider: user.authProvider,
    };
  }
}
