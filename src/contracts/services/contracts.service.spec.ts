import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractEventsService } from './contract-events.service';
import { ContractPdfService } from './contract-pdf.service';
import { ContractsService } from './contracts.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'creator-1',
    email: 'creator@example.com',
    isEmailVerified: true,
    isActive: true,
    roles: ['USER'],
    permissions: [],
    ...overrides,
  };
}

function buildDeal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'deal-1',
    brandId: 'brand-1',
    creatorId: 'creator-1',
    status: 'ACTIVE',
    contract: null,
    ...overrides,
  };
}

function buildContract(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'contract-1',
    dealId: 'deal-1',
    brandId: 'brand-1',
    creatorId: 'creator-1',
    status: 'DRAFT',
    executedAt: null,
    voidedAt: null,
    voidReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildVersion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'version-1',
    contractId: 'contract-1',
    versionNumber: 1,
    content: 'Terms of the agreement...',
    pdfFilename: null,
    createdById: 'owner-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ContractsService', () => {
  let prisma: {
    deal: { findUnique: ReturnType<typeof vi.fn> };
    brand: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    contract: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    contractVersion: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let pdfService: { generate: ReturnType<typeof vi.fn> };
  let eventsService: { record: ReturnType<typeof vi.fn> };
  let service: ContractsService;

  beforeEach(() => {
    prisma = {
      deal: { findUnique: vi.fn() },
      brand: { findUnique: vi.fn(), findMany: vi.fn() },
      contract: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      contractVersion: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    pdfService = { generate: vi.fn().mockResolvedValue('contract-1-v1.pdf') };
    eventsService = { record: vi.fn().mockResolvedValue(undefined) };
    service = new ContractsService(
      prisma as unknown as PrismaService,
      pdfService as unknown as ContractPdfService,
      eventsService as unknown as ContractEventsService,
    );
  });

  describe('create', () => {
    it('throws NotFoundException when the deal does not exist', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.create(buildUser({ id: 'owner-1' }), {
          dealId: 'deal-1',
          content: 'Terms of the agreement, long enough to pass validation.',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the deal is not active', async () => {
      prisma.deal.findUnique.mockResolvedValue(
        buildDeal({ status: 'NEGOTIATING' }),
      );

      await expect(
        service.create(buildUser({ id: 'owner-1' }), {
          dealId: 'deal-1',
          content: 'Terms of the agreement, long enough to pass validation.',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ConflictException when a contract already exists', async () => {
      prisma.deal.findUnique.mockResolvedValue(
        buildDeal({ contract: buildContract() }),
      );

      await expect(
        service.create(buildUser({ id: 'owner-1' }), {
          dealId: 'deal-1',
          content: 'Terms of the agreement, long enough to pass validation.',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal());
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      await expect(
        service.create(buildUser({ id: 'stranger' }), {
          dealId: 'deal-1',
          content: 'Terms of the agreement, long enough to pass validation.',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a draft contract with version 1 and generates a PDF', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal());
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.contract.create.mockResolvedValue({
        ...buildContract(),
        versions: [buildVersion()],
      });

      const result = await service.create(buildUser({ id: 'owner-1' }), {
        dealId: 'deal-1',
        content: 'Terms of the agreement, long enough to pass validation.',
      });

      expect(pdfService.generate).toHaveBeenCalledWith(
        'contract-1',
        1,
        'Terms of the agreement...',
      );
      expect(result.status).toBe('DRAFT');
      expect(result.currentVersionNumber).toBe(1);
    });
  });

  describe('assertParticipant', () => {
    it('allows the creator', async () => {
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      await expect(
        service.assertParticipant(buildContract(), buildUser()),
      ).resolves.toBeUndefined();
    });

    it('allows the brand owner', async () => {
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      await expect(
        service.assertParticipant(
          buildContract(),
          buildUser({ id: 'owner-1' }),
        ),
      ).resolves.toBeUndefined();
    });

    it('rejects an unrelated user', async () => {
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      await expect(
        service.assertParticipant(
          buildContract(),
          buildUser({ id: 'stranger' }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('createVersion', () => {
    it('rejects modifying an executed contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(
        buildContract({ status: 'EXECUTED' }),
      );
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      await expect(
        service.createVersion('contract-1', buildUser(), {
          content: 'Updated terms, long enough to pass validation.',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates version 2, regenerates the PDF, and resets status to draft', async () => {
      prisma.contract.findUnique.mockResolvedValue(buildContract());
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.contractVersion.findFirst.mockResolvedValue(buildVersion());
      prisma.contractVersion.create.mockResolvedValue(
        buildVersion({ id: 'version-2', versionNumber: 2 }),
      );
      prisma.contract.update.mockResolvedValue(
        buildContract({ status: 'DRAFT' }),
      );

      const result = await service.createVersion('contract-1', buildUser(), {
        content: 'Updated terms, long enough to pass validation.',
      });

      expect(prisma.contractVersion.create).toHaveBeenCalledWith({
        data: {
          contractId: 'contract-1',
          versionNumber: 2,
          content: 'Updated terms, long enough to pass validation.',
          createdById: 'creator-1',
        },
      });
      expect(result.status).toBe('DRAFT');
      expect(result.currentVersionNumber).toBe(2);
    });
  });

  describe('sendForSignature', () => {
    it('rejects sending a non-draft contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(
        buildContract({ status: 'AWAITING_SIGNATURE' }),
      );
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      await expect(
        service.sendForSignature('contract-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('moves a draft contract to awaiting signature', async () => {
      prisma.contract.findUnique.mockResolvedValue(buildContract());
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.contractVersion.findFirst.mockResolvedValue(buildVersion());
      prisma.contract.update.mockResolvedValue(
        buildContract({ status: 'AWAITING_SIGNATURE' }),
      );

      const result = await service.sendForSignature('contract-1', buildUser());
      expect(result.status).toBe('AWAITING_SIGNATURE');
    });
  });

  describe('void', () => {
    it('rejects voiding an already-executed contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(
        buildContract({ status: 'EXECUTED' }),
      );
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      await expect(
        service.void('contract-1', buildUser(), {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('voids a draft contract with a reason', async () => {
      prisma.contract.findUnique.mockResolvedValue(buildContract());
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.contractVersion.findFirst.mockResolvedValue(buildVersion());
      prisma.contract.update.mockResolvedValue(
        buildContract({ status: 'VOIDED', voidReason: 'Changed plans' }),
      );

      const result = await service.void('contract-1', buildUser(), {
        reason: 'Changed plans',
      });
      expect(result.status).toBe('VOIDED');
      expect(result.voidReason).toBe('Changed plans');
    });
  });
});
