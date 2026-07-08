export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: 'local' | 'google';
}
