import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { AttachmentsService } from './attachments.service';
import { UploadAttachmentDto, uploadAttachmentSchema } from './dto/upload-attachment.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('expenses/:id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) expenseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(uploadAttachmentSchema)) body: UploadAttachmentDto,
  ) {
    return { attachment: await this.attachmentsService.upload(user.sub, expenseId, file, body) };
  }

  @Get('expenses/:id/attachments')
  async list(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) expenseId: string,
  ) {
    return { attachments: await this.attachmentsService.list(user.sub, expenseId) };
  }

  @Delete('attachments/:id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) attachmentId: string,
  ) {
    return this.attachmentsService.remove(user.sub, attachmentId);
  }
}
