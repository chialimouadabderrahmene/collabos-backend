import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainEventRegistry } from '../../events/domain-event-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentSucceededEvent } from './payment-succeeded.event';
import { PaymentSucceededHandler } from './payment-succeeded.handler';

describe('PaymentSucceededHandler', () => {
  let prisma: { auditLog: { create: ReturnType<typeof vi.fn> } };
  let registry: DomainEventRegistry;
  let handler: PaymentSucceededHandler;

  beforeEach(() => {
    prisma = { auditLog: { create: vi.fn().mockResolvedValue(undefined) } };
    registry = new DomainEventRegistry();
    handler = new PaymentSucceededHandler(
      prisma as unknown as PrismaService,
      registry,
    );
  });

  it('registers its event type with the domain event registry on construction', () => {
    expect(registry.has('payment.succeeded')).toBe(true);

    const rebuilt = registry.create('payment.succeeded', {
      paymentId: 'p1',
      payerId: 'buyer-1',
      amount: 120,
      currency: 'USD',
    });

    expect(rebuilt).toBeInstanceOf(PaymentSucceededEvent);
  });

  describe('handle', () => {
    it('writes an audit log entry for the payment', async () => {
      const event = new PaymentSucceededEvent({
        paymentId: 'payment-1',
        payerId: 'buyer-1',
        amount: 120,
        currency: 'USD',
      });

      await handler.handle(event);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'buyer-1',
          action: 'PAYMENT_SUCCEEDED',
          metadata: { paymentId: 'payment-1', amount: 120, currency: 'USD' },
        },
      });
    });

    it('swallows and logs a failure instead of throwing back into the event bus', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));
      const event = new PaymentSucceededEvent({
        paymentId: 'payment-1',
        payerId: 'buyer-1',
        amount: 120,
        currency: 'USD',
      });

      await expect(handler.handle(event)).resolves.toBeUndefined();
    });
  });
});
