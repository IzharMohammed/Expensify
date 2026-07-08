import { Body, Controller, Delete, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '../auth/zod-validation.pipe';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, createCategorySchema } from './dto/create-category.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return {
      categories: await this.categoriesService.listForUser(user.sub),
    };
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createCategorySchema))
  async create(@CurrentUser() user: JwtPayload, @Body() body: CreateCategoryDto) {
    return {
      category: await this.categoriesService.create(user.sub, body),
    };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.categoriesService.delete(user.sub, id);
  }
}
