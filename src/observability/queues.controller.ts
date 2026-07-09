import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Roles } from '../auth/decorators/roles.decorator';
import { DROPS_QUEUE } from '../drops/services/drops.service';
import { NOTIFICATIONS_QUEUE } from '../notifications/constants/notifications-queue.constant';
import {
  QueueStatusResponse,
  QueuesStatusResponse,
} from './types/queue-status.types';

@ApiTags('observability/queues')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('observability/queues')
export class QueuesController {
  constructor(
    @InjectQueue(DROPS_QUEUE) private readonly dropsQueue: Queue,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get BullMQ job counts per queue (admin only)' })
  @ApiResponse({ status: 200, type: QueuesStatusResponse })
  async getStatus(): Promise<QueuesStatusResponse> {
    const [drops, notifications] = await Promise.all([
      this.toStatus(DROPS_QUEUE, this.dropsQueue),
      this.toStatus(NOTIFICATIONS_QUEUE, this.notificationsQueue),
    ]);

    return { queues: [drops, notifications] };
  }

  private async toStatus(
    name: string,
    queue: Queue,
  ): Promise<QueueStatusResponse> {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );

    return {
      name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    };
  }
}
