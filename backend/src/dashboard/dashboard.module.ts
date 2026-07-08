import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CategoriesModule } from '../categories/categories.module';
import { DashboardController } from './dashboard.controller';
import { DashboardEventsService } from './dashboard-events.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [CategoriesModule, JwtModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardEventsService],
  exports: [DashboardService, DashboardEventsService],
})
export class DashboardModule {}
