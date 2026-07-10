import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../auth/zod-validation.pipe';
import { ChatService } from './chat.service';
import { ChatRequestDto, chatRequestSchema } from './dto/chat.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequestDto,
  ) {
    return this.chatService.chat(user.sub, body);
  }

  @Get(':conversationId')
  async history(@CurrentUser() user: JwtPayload, @Param('conversationId') conversationId: string) {
    return this.chatService.listConversation(user.sub, conversationId);
  }
}
