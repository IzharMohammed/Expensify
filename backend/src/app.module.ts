import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { DrizzleModule } from './database/drizzle.module';
import { ExpensesModule } from './expenses/expenses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 20,
      },
    ]),
    DrizzleModule,
    AuthModule,
    CategoriesModule,
    ExpensesModule,
  ],
})
export class AppModule {}
