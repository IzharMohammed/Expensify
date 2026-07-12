import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class NotificationsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsQueueService.name);
  private readonly queueName = 'notifications';
  private readonly redisConnection: any;
  private readonly queue: any;
  private readonly worker: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(this.queueName, {
      connection: this.redisConnection,
    });
    this.worker = new Worker(
      this.queueName,
      async (job: Job) => {
        if (job.name === 'daily-no-spend-nudge') {
          await this.notificationsService.createNoSpendNudges();
          return;
        }

        if (job.name === 'weekly-weekend-anomaly') {
          await this.notificationsService.createWeekendAnomalyAlerts();
        }
      },
      {
        connection: this.redisConnection.duplicate(),
      },
    );
    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(`Notification job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
    this.worker.on('completed', (job: Job) => {
      this.logger.log(`Notification job ${job.id} completed successfully`);
    });
  }

  async onModuleInit() {
    await this.queue.add(
      'daily-no-spend-nudge',
      {},
      {
        jobId: 'daily-no-spend-nudge',
        repeat: { pattern: this.getNoSpendCronPattern() },
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    );

    await this.queue.add(
      'weekly-weekend-anomaly',
      {},
      {
        jobId: 'weekly-weekend-anomaly',
        repeat: { pattern: this.getWeekendAnomalyCronPattern() },
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

  getNoSpendCronPattern() {
    return this.configService.get<string>('NO_SPEND_NUDGE_CRON') ?? '0 20 * * *';
  }

  getWeekendAnomalyCronPattern() {
    return this.configService.get<string>('WEEKEND_ANOMALY_CRON') ?? '0 8 * * 1';
  }
}
