import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardInstance, InjectBullBoard } from '@bull-board/nestjs';
import { InsightsQueueService } from './insights-queue.service';

@Injectable()
export class QueueBoardService implements OnModuleInit {
  constructor(
    @InjectBullBoard() private readonly board: BullBoardInstance,
    private readonly insightsQueueService: InsightsQueueService,
  ) {}

  onModuleInit() {
    this.board.addQueue(
      new BullMQAdapter(this.insightsQueueService.getQueue(), {
        description: `Nightly AI insights job. Cron: ${this.insightsQueueService.getCronPattern()}`,
      }),
    );
  }
}
