import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../auth/zod-validation.pipe';
import { CreateExpenseDto, createExpenseSchema } from './dto/create-expense.dto';
import { ParseExpenseDto, parseExpenseSchema } from './dto/parse-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('parse')
  async parse(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(parseExpenseSchema)) body: ParseExpenseDto,
  ) {
    return this.expensesService.parseText(user.sub, body.text);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseDto,
  ) {
    return this.expensesService.createExpense(user.sub, body);
  }

  @Post('voice')
  @UseInterceptors(FileInterceptor('audio', { storage: memoryStorage() }))
  async voice(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return this.expensesService.parseVoice(user.sub, file);
  }

  @Post('ocr')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async ocr(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return this.expensesService.parseReceipt(user.sub, file);
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return {
      expenses: await this.expensesService.listRecent(user.sub),
    };
  }
}
