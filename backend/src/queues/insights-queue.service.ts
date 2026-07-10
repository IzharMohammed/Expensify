import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { InsightsService } from '../insights/insights.service';

@Injectable()
export class InsightsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InsightsQueueService.name);
  private readonly queueName = 'insights';
  private readonly redisConnection: any;
  private readonly queue: any;
  private readonly worker: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly insightsService: InsightsService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(this.queueName, {
      connection: this.redisConnection,
    });
    this.worker = new Worker(
      this.queueName,
      async (_job: Job) => {
        await this.insightsService.generateForAllUsers(new Date());
      },
      {
        connection: this.redisConnection.duplicate(),
      },
    );
    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(`Insights job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });

    this.worker.on('completed', (job: Job) => {
      this.logger.log(`Insights job ${job.id} completed successfully`);
    });
  }

  async onModuleInit() {
    const cron = this.configService.get<string>('INSIGHTS_CRON') ?? '0 23 * * *';
    await this.queue.add(
      'nightly-insights',
      {},
      {
        jobId: 'nightly-insights',
        repeat: { pattern: cron },
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

  getCronPattern() {
    return this.configService.get<string>('INSIGHTS_CRON') ?? '0 23 * * *';
  }
}
