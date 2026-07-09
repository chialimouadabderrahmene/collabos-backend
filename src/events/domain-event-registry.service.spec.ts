import { describe, expect, it } from 'vitest';
import { DomainEventRegistry } from './domain-event-registry.service';

class FakeEvent {
  constructor(public readonly payload: Record<string, unknown>) {}
}

describe('DomainEventRegistry', () => {
  it('reconstructs a registered event type from its payload', () => {
    const registry = new DomainEventRegistry();
    registry.register('payment.succeeded', (payload) => new FakeEvent(payload));

    const event = registry.create('payment.succeeded', { paymentId: 'p1' });

    expect(event).toBeInstanceOf(FakeEvent);
    expect((event as FakeEvent).payload).toEqual({ paymentId: 'p1' });
  });

  it('returns null and logs a warning for an unregistered event type', () => {
    const registry = new DomainEventRegistry();

    const event = registry.create('unknown.type', {});

    expect(event).toBeNull();
  });

  describe('has', () => {
    it('reports whether an event type is registered', () => {
      const registry = new DomainEventRegistry();
      registry.register(
        'payment.succeeded',
        (payload) => new FakeEvent(payload),
      );

      expect(registry.has('payment.succeeded')).toBe(true);
      expect(registry.has('payment.refunded')).toBe(false);
    });
  });
});
