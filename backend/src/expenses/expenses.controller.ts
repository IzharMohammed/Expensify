import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { SearchExpensesDto, searchExpensesSchema } from './dto/search-expenses.dto';
import {
  UpdateExpenseTagsDto,
  updateExpenseTagsSchema,
} from './dto/update-expense-tags.dto';
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

  @Get('search')
  async search(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(searchExpensesSchema)) query: SearchExpensesDto,
  ) {
    return this.expensesService.search(user.sub, query);
  }

  @Post(':id/tags')
  async addTags(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) expenseId: string,
    @Body(new ZodValidationPipe(updateExpenseTagsSchema)) body: UpdateExpenseTagsDto,
  ) {
    return this.expensesService.addTags(user.sub, expenseId, body);
  }

  @Delete(':id/tags/:tagId')
  async removeTag(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) expenseId: string,
    @Param('tagId', new ParseUUIDPipe()) tagId: string,
  ) {
    return this.expensesService.removeTag(user.sub, expenseId, tagId);
  }
}
