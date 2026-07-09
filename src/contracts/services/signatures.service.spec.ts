import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractEventsService } from './contract-events.service';
import { ContractsService } from './contracts.service';
import { SignaturesService } from './signatures.service';

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

function buildContract(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'contract-1',
    brandId: 'brand-1',
    creatorId: 'creator-1',
    status: 'AWAITING_SIGNATURE',
    ...overrides,
  };
}

function buildVersion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'version-1',
    contractId: 'contract-1',
    versionNumber: 1,
    ...overrides,
  };
}

function buildSignature(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'signature-1',
    contractVersionId: 'version-1',
    signerId: 'creator-1',
    party: 'CREATOR',
    signedName: 'Jane Doe',
    ipAddress: '127.0.0.1',
    signedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SignaturesService', () => {
  let prisma: {
    brand: { findUnique: ReturnType<typeof vi.fn> };
    contractSignature: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    contract: { update: ReturnType<typeof vi.fn> };
  };
  let contractsService: ContractsService;
  let eventsService: { record: ReturnType<typeof vi.fn> };
  let service: SignaturesService;

  beforeEach(() => {
    prisma = {
      brand: { findUnique: vi.fn().mockResolvedValue({ ownerId: 'owner-1' }) },
      contractSignature: {
        findUnique: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      contract: { update: vi.fn() },
    };
    contractsService = {
      findEntityOrThrow: vi.fn().mockResolvedValue(buildContract()),
      assertParticipant: vi.fn().mockResolvedValue(undefined),
      getLatestVersionEntity: vi.fn().mockResolvedValue(buildVersion()),
    } as unknown as ContractsService;
    eventsService = { record: vi.fn().mockResolvedValue(undefined) };
    service = new SignaturesService(
      prisma as unknown as PrismaService,
      contractsService,
      eventsService as unknown as ContractEventsService,
    );
  });

  describe('sign', () => {
    it('rejects signing a contract that is not awaiting signatures', async () => {
      vi.spyOn(contractsService, 'findEntityOrThrow').mockResolvedValue(
        buildContract({ status: 'DRAFT' }) as never,
      );

      await expect(
        service.sign('contract-1', buildUser(), { signedName: 'Jane Doe' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a user who is neither the creator nor the brand owner', async () => {
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      await expect(
        service.sign('contract-1', buildUser({ id: 'stranger' }), {
          signedName: 'Jane Doe',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a party signing twice for the same version', async () => {
      prisma.contractSignature.findUnique.mockResolvedValue(buildSignature());

      await expect(
        service.sign('contract-1', buildUser(), { signedName: 'Jane Doe' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('marks the contract partially signed after the first signature', async () => {
      prisma.contractSignature.findUnique.mockResolvedValue(null);
      prisma.contractSignature.create.mockResolvedValue(buildSignature());
      prisma.contractSignature.count.mockResolvedValue(1);

      const result = await service.sign('contract-1', buildUser(), {
        signedName: 'Jane Doe',
      });

      expect(prisma.contract.update).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        data: { status: 'PARTIALLY_SIGNED' },
      });
      expect(result.party).toBe('CREATOR');
    });

    it('fully executes the contract once both parties have signed', async () => {
      prisma.contractSignature.findUnique.mockResolvedValue(null);
      prisma.contractSignature.create.mockResolvedValue(
        buildSignature({ party: 'BRAND', signerId: 'owner-1' }),
      );
      prisma.contractSignature.count.mockResolvedValue(2);

      await service.sign('contract-1', buildUser({ id: 'owner-1' }), {
        signedName: 'Brand Owner',
      });

      expect(prisma.contract.update).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        data: { status: 'EXECUTED', executedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('findAll', () => {
    it('returns signatures for the latest version only', async () => {
      prisma.contractSignature.findMany.mockResolvedValue([buildSignature()]);

      const result = await service.findAll('contract-1', buildUser());

      expect(prisma.contractSignature.findMany).toHaveBeenCalledWith({
        where: { contractVersionId: 'version-1' },
        orderBy: { signedAt: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });
});
