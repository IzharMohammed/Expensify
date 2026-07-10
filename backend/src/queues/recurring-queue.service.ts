import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { RecurringService } from '../recurring/recurring.service';

@Injectable()
export class RecurringQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecurringQueueService.name);
  private readonly queueName = 'recurring';
  private readonly redisConnection: any;
  private readonly queue: any;
  private readonly worker: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly recurringService: RecurringService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(this.queueName, {
      connection: this.redisConnection,
    });
    this.worker = new Worker(
      this.queueName,
      async (job: Job) => {
        if (job.name === 'weekly-recurring-detection') {
          await this.recurringService.detectForAllUsers();
          return;
        }

        if (job.name === 'daily-recurring-reminders') {
          await this.recurringService.createDueNotificationsForAllUsers();
        }
      },
      {
        connection: this.redisConnection.duplicate(),
      },
    );
    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(`Recurring job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
    this.worker.on('completed', (job: Job) => {
      this.logger.log(`Recurring job ${job.id} completed successfully`);
    });
  }

  async onModuleInit() {
    await this.queue.add(
      'weekly-recurring-detection',
      {},
      {
        jobId: 'weekly-recurring-detection',
        repeat: { pattern: this.getDetectionCronPattern() },
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    );

    await this.queue.add(
      'daily-recurring-reminders',
      {},
      {
        jobId: 'daily-recurring-reminders',
        repeat: { pattern: this.getReminderCronPattern() },
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    );
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.worker.close(),
      this.queue.close(),
      this.redisConnection.quit(),
    ]);
  }

  getQueue() {
    return this.queue;
  }

  getDetectionCronPattern() {
    return this.configService.get<string>('RECURRING_SCAN_CRON') ?? '0 2 * * 1';
  }

  getReminderCronPattern() {
    return this.configService.get<string>('RECURRING_REMINDER_CRON') ?? '0 9 * * *';
  }
}
