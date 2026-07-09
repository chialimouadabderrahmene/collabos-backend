import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const presenceKey = (userId: string): string => `messaging:presence:${userId}`;

@Injectable()
export class PresenceService {
  constructor(private readonly redisService: RedisService) {}

  async addConnection(userId: string, socketId: string): Promise<number> {
    const client = this.redisService.getClient();
    await client.sadd(presenceKey(userId), socketId);
    return client.scard(presenceKey(userId));
  }

  async removeConnection(userId: string, socketId: string): Promise<number> {
    const client = this.redisService.getClient();
    await client.srem(presenceKey(userId), socketId);
    return client.scard(presenceKey(userId));
  }

  async isOnline(userId: string): Promise<boolean> {
    const count = await this.redisService
      .getClient()
      .scard(presenceKey(userId));
    return count > 0;
  }

  async areOnline(userIds: string[]): Promise<Map<string, boolean>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const client = this.redisService.getClient();
    const pipeline = client.pipeline();
    for (const userId of userIds) {
      pipeline.scard(presenceKey(userId));
    }
    const results = await pipeline.exec();

    const online = new Map<string, boolean>();
    userIds.forEach((userId, index) => {
      const count = (results?.[index]?.[1] as number | undefined) ?? 0;
      online.set(userId, count > 0);
    });

    return online;
  }
}
