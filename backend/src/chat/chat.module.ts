import { Module } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { ChatAiService } from './chat-ai.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatAiService, CategoriesService],
})
export class ChatModule {}
