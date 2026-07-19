import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardInstance, InjectBullBoard } from '@bull-board/nestjs';
import { InsightsQueueService } from './insights-queue.service';
import { GamificationQueueService } from './gamification-queue.service';
import { NotificationsQueueService } from './notifications-queue.service';
import { RecurringQueueService } from './recurring-queue.service';

@Injectable()
export class QueueBoardService implements OnModuleInit {
  constructor(
    @InjectBullBoard() private readonly board: BullBoardInstance,
    private readonly insightsQueueService: InsightsQueueService,
    private readonly gamificationQueueService: GamificationQueueService,
    private readonly notificationsQueueService: NotificationsQueueService,
    private readonly recurringQueueService: RecurringQueueService,
  ) {}

  onModuleInit() {
    this.board.addQueue(
      new BullMQAdapter(this.gamificationQueueService.getQueue(), {
        description: `Daily streak and badge evaluation. Cron: ${this.gamificationQueueService.getScheduleDescription()}`,
      }),
    );
    this.board.addQueue(
      new BullMQAdapter(this.insightsQueueService.getQueue(), {
        description: `Nightly AI insights job. Cron: ${this.insightsQueueService.getCronPattern()}`,
      }),
    );
    this.board.addQueue(
      new BullMQAdapter(this.notificationsQueueService.getQueue(), {
        description: `Notification jobs. No-spend: ${this.notificationsQueueService.getNoSpendCronPattern()} · Weekend anomaly: ${this.notificationsQueueService.getWeekendAnomalyCronPattern()}`,
      }),
    );
    this.board.addQueue(
      new BullMQAdapter(this.recurringQueueService.getQueue(), {
        description: `Recurring detection and reminder jobs. Detect: ${this.recurringQueueService.getDetectionCronPattern()} · Reminders: ${this.recurringQueueService.getReminderCronPattern()}`,
      }),
    );
  }
}
