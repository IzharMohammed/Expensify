import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class GamificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GamificationQueueService.name);
  private readonly queueName = 'gamification';
  private readonly redisConnection: any;
  private readonly queue: any;
  private readonly worker: any;

  constructor(
    config: ConfigService,
    private readonly gamification: GamificationService,
  ) {
    const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(this.queueName, { connection: this.redisConnection });
    this.worker = new Worker(
      this.queueName,
      async (job: Job) => {
        if (job.name === 'daily-streaks-and-badges') {
          await this.gamification.evaluateAllUsers(new Date());
        }
      },
      { connection: this.redisConnection.duplicate() },
    );
    this.worker.on('completed', (job: Job) =>
      this.logger.log(`Gamification job ${job.id} completed successfully`),
    );
    this.worker.on('failed', (job: Job | undefined, error: Error) =>
      this.logger.error(`Gamification job ${job?.id ?? 'unknown'} failed: ${error.message}`),
    );
    this.cron = config.get<string>('GAMIFICATION_CRON') ?? '15 0 * * *';
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Kolkata';
  }

  private readonly cron: string;
  private readonly timeZone: string;

  async onModuleInit() {
    await this.queue.add(
      'daily-streaks-and-badges',
      {},
      {
        jobId: 'daily-streaks-and-badges',
        repeat: { pattern: this.cron, tz: this.timeZone },
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 14,
        removeOnFail: 30,
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

  getScheduleDescription() {
    return `${this.cron} (${this.timeZone})`;
  }
}
