import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplatesService } from './templates.service';

function buildTemplate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'template-1',
    key: 'order.paid',
    name: 'Order Paid',
    emailSubject: 'Your order {{orderId}} was paid',
    emailBody: '<p>Thanks for your order {{orderId}}</p>',
    pushTitle: 'Order paid',
    pushBody: 'Order {{orderId}} was paid',
    inAppBody: 'Your order {{orderId}} was paid',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TemplatesService', () => {
  let prisma: {
    notificationTemplate: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let service: TemplatesService;

  beforeEach(() => {
    prisma = {
      notificationTemplate: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new TemplatesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects a duplicate key', async () => {
      prisma.notificationTemplate.findUnique.mockResolvedValue(buildTemplate());

      await expect(
        service.create({ key: 'order.paid', name: 'Order Paid' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a new template', async () => {
      prisma.notificationTemplate.findUnique.mockResolvedValue(null);
      prisma.notificationTemplate.create.mockResolvedValue(buildTemplate());

      const result = await service.create({
        key: 'order.paid',
        name: 'Order Paid',
      });

      expect(result.key).toBe('order.paid');
    });
  });

  describe('getActiveOrThrow', () => {
    it('throws NotFoundException for a missing template', async () => {
      prisma.notificationTemplate.findUnique.mockResolvedValue(null);

      await expect(service.getActiveOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException for an inactive template', async () => {
      prisma.notificationTemplate.findUnique.mockResolvedValue(
        buildTemplate({ isActive: false }),
      );

      await expect(
        service.getActiveOrThrow('order.paid'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns an active template', async () => {
      prisma.notificationTemplate.findUnique.mockResolvedValue(buildTemplate());

      await expect(service.getActiveOrThrow('order.paid')).resolves.toEqual(
        buildTemplate(),
      );
    });
  });

  describe('render', () => {
    it('interpolates {{variables}} across every channel field', () => {
      const rendered = service.render(buildTemplate(), { orderId: 'ord-42' });

      expect(rendered).toEqual({
        emailSubject: 'Your order ord-42 was paid',
        emailBody: '<p>Thanks for your order ord-42</p>',
        pushTitle: 'Order paid',
        pushBody: 'Order ord-42 was paid',
        inAppBody: 'Your order ord-42 was paid',
      });
    });

    it('leaves a placeholder untouched when the variable is missing', () => {
      const rendered = service.render(
        buildTemplate({
          pushBody: 'Order {{orderId}} shipped via {{carrier}}',
        }),
        { orderId: 'ord-42' },
      );

      expect(rendered.pushBody).toBe('Order ord-42 shipped via {{carrier}}');
    });

    it('passes through null fields untouched', () => {
      const rendered = service.render(
        buildTemplate({ emailSubject: null }),
        {},
      );

      expect(rendered.emailSubject).toBeNull();
    });
  });
});
