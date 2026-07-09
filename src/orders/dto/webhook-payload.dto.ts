import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum WebhookEventType {
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_PROCESSED = 'refund_processed',
}

export class WebhookPayloadDto {
  @ApiProperty({ enum: WebhookEventType })
  @IsEnum(WebhookEventType)
  eventType!: WebhookEventType;

  @ApiProperty()
  @IsUUID('4')
  orderId!: string;

  @ApiPropertyOptional({ description: 'Required for refund_processed events' })
  @IsOptional()
  @IsUUID('4')
  refundId?: string;
}
