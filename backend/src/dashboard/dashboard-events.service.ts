import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType, createClient } from '@redis/client';
import { DashboardStreamEvent } from './types/dashboard.types';

@Injectable()
export class DashboardEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(DashboardEventsService.name);
  private readonly redisUrl: string;
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
  }

  async publish(userId: string, event: DashboardStreamEvent) {
    await this.ensureClients();
    await this.publisher!.publish(this.channel(userId), JSON.stringify(event));
  }

  async subscribe(userId: string, onMessage: (event: DashboardStreamEvent) => void) {
    await this.ensureClients();

    const channel = this.channel(userId);
    const listener = (message: string) => {
      try {
        onMessage(JSON.parse(message) as DashboardStreamEvent);
      } catch (error) {
        this.logger.warn(`Invalid dashboard event payload on ${channel}`);
      }
    };

    await this.subscriber!.subscribe(channel, listener);

    return async () => {
      await this.subscriber?.unsubscribe(channel, listener);
    };
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.publisher?.quit(),
      this.subscriber?.quit(),
    ]);
  }

  private async ensureClients() {
    if (this.publisher?.isOpen && this.subscriber?.isOpen) {
      return;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.connect();
    }

    await this.connectPromise;
  }

  private async connect() {
    this.publisher = createClient({ url: this.redisUrl });
    this.subscriber = this.publisher.duplicate();
    this.publisher.on('error', (error: Error) => this.logger.error(`Redis publisher error: ${error.message}`));
    this.subscriber.on('error', (error: Error) => this.logger.error(`Redis subscriber error: ${error.message}`));
    await this.publisher.connect();
    await this.subscriber.connect();
  }

  private channel(userId: string) {
    return `dashboard:user:${userId}`;
  }
}
