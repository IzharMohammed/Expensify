import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { StorageService } from '../storage/storage.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { GroqService } from './groq.service';

@Module({
  imports: [CategoriesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, GroqService, StorageService],
})
export class ExpensesModule {}
