import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgreementStatus,
  Contract,
  ContractEventType,
  ContractVersion,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from '../dto/create-contract.dto';
import { CreateVersionDto } from '../dto/create-version.dto';
import { ListContractsQueryDto } from '../dto/list-contracts-query.dto';
import { VoidContractDto } from '../dto/void-contract.dto';
import { toContractResponse } from '../mappers/contract.mapper';
import {
  ContractResponse,
  PaginatedContractsResponse,
} from '../types/contract-response.types';
import { ContractEventsService } from './contract-events.service';
import { ContractPdfService } from './contract-pdf.service';

const NON_TERMINAL_STATUSES: AgreementStatus[] = [
  AgreementStatus.DRAFT,
  AgreementStatus.AWAITING_SIGNATURE,
  AgreementStatus.PARTIALLY_SIGNED,
];

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: ContractPdfService,
    private readonly eventsService: ContractEventsService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateContractDto,
  ): Promise<ContractResponse> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
      include: { contract: true },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    if (deal.status !== 'ACTIVE') {
      throw new ConflictException(
        'A contract can only be created for an active deal',
      );
    }

    if (deal.contract) {
      throw new ConflictException('A contract already exists for this deal');
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: deal.brandId },
    });

    const isBrandOwner = brand?.ownerId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isBrandOwner && !isAdmin) {
      throw new ForbiddenException(
        'Only the brand owner can initiate a contract for this deal',
      );
    }

    const contract = await this.prisma.contract.create({
      data: {
        dealId: deal.id,
        brandId: deal.brandId,
        creatorId: deal.creatorId,
        versions: {
          create: {
            versionNumber: 1,
            content: dto.content,
            createdById: user.id,
          },
        },
      },
      include: { versions: true },
    });

    const version = contract.versions[0];
    await this.attachPdf(contract.id, version);

    await this.eventsService.record(
      contract.id,
      ContractEventType.CREATED,
      user.id,
    );
    await this.eventsService.record(
      contract.id,
      ContractEventType.VERSION_CREATED,
      user.id,
      { versionNumber: 1 },
    );

    return toContractResponse(contract, 1);
  }

  async findAll(
    user: AuthenticatedUser,
    query: ListContractsQueryDto,
  ): Promise<PaginatedContractsResponse> {
    const ownedBrandIds = await this.prisma.brand.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });

    const where: Prisma.ContractWhereInput = {
      OR: [
        { creatorId: user.id },
        { brandId: { in: ownedBrandIds.map((brand) => brand.id) } },
      ],
      ...(query.status ? { status: query.status } : {}),
    };

    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      data: contracts.map((contract) =>
        toContractResponse(contract, contract.versions[0]?.versionNumber ?? 0),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ContractResponse> {
    const contract = await this.findEntityOrThrow(id);
    await this.assertParticipant(contract, user);

    const latestVersion = await this.getLatestVersionEntity(id);

    return toContractResponse(contract, latestVersion.versionNumber);
  }

  async createVersion(
    contractId: string,
    user: AuthenticatedUser,
    dto: CreateVersionDto,
  ): Promise<ContractResponse> {
    const contract = await this.findEntityOrThrow(contractId);
    await this.assertParticipant(contract, user);
    this.assertMutable(contract.status);

    const latest = await this.getLatestVersionEntity(contractId);
    const nextVersionNumber = latest.versionNumber + 1;

    const version = await this.prisma.contractVersion.create({
      data: {
        contractId,
        versionNumber: nextVersionNumber,
        content: dto.content,
        createdById: user.id,
      },
    });

    await this.attachPdf(contractId, version);

    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: AgreementStatus.DRAFT },
    });

    await this.eventsService.record(
      contractId,
      ContractEventType.VERSION_CREATED,
      user.id,
      { versionNumber: nextVersionNumber },
    );

    return toContractResponse(updated, nextVersionNumber);
  }

  async sendForSignature(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ContractResponse> {
    const contract = await this.findEntityOrThrow(id);
    await this.assertParticipant(contract, user);

    if (contract.status !== AgreementStatus.DRAFT) {
      throw new ConflictException(
        'Only draft contracts can be sent for signature',
      );
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: { status: AgreementStatus.AWAITING_SIGNATURE },
    });

    await this.eventsService.record(
      id,
      ContractEventType.SENT_FOR_SIGNATURE,
      user.id,
    );

    const latest = await this.getLatestVersionEntity(id);
    return toContractResponse(updated, latest.versionNumber);
  }

  async void(
    id: string,
    user: AuthenticatedUser,
    dto: VoidContractDto,
  ): Promise<ContractResponse> {
    const contract = await this.findEntityOrThrow(id);
    await this.assertParticipant(contract, user);

    if (!NON_TERMINAL_STATUSES.includes(contract.status)) {
      throw new ConflictException('This contract can no longer be voided');
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        status: AgreementStatus.VOIDED,
        voidedAt: new Date(),
        voidReason: dto.reason,
      },
    });

    await this.eventsService.record(id, ContractEventType.VOIDED, user.id, {
      reason: dto.reason,
    });

    const latest = await this.getLatestVersionEntity(id);
    return toContractResponse(updated, latest.versionNumber);
  }

  async findEntityOrThrow(id: string): Promise<Contract> {
    const contract = await this.prisma.contract.findUnique({ where: { id } });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async getVersionOrThrow(
    contractId: string,
    versionNumber: number,
  ): Promise<ContractVersion> {
    const version = await this.prisma.contractVersion.findUnique({
      where: { contractId_versionNumber: { contractId, versionNumber } },
    });

    if (!version) {
      throw new NotFoundException('Contract version not found');
    }

    return version;
  }

  async findVersionsWithSignatures(contractId: string) {
    return this.prisma.contractVersion.findMany({
      where: { contractId },
      include: { signatures: true },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async getLatestVersionEntity(contractId: string): Promise<ContractVersion> {
    const version = await this.prisma.contractVersion.findFirst({
      where: { contractId },
      orderBy: { versionNumber: 'desc' },
    });

    if (!version) {
      throw new NotFoundException('Contract has no versions');
    }

    return version;
  }

  async assertParticipant(
    contract: Contract,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (contract.creatorId === user.id || user.roles.includes('ADMIN')) {
      return;
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: contract.brandId },
    });

    if (brand?.ownerId === user.id) {
      return;
    }

    throw new ForbiddenException('You do not have access to this contract');
  }

  private assertMutable(status: AgreementStatus): void {
    if (!NON_TERMINAL_STATUSES.includes(status)) {
      throw new ConflictException('This contract can no longer be modified');
    }
  }

  private async attachPdf(
    contractId: string,
    version: ContractVersion,
  ): Promise<void> {
    const filename = await this.pdfService.generate(
      contractId,
      version.versionNumber,
      version.content,
    );

    await this.prisma.contractVersion.update({
      where: { id: version.id },
      data: { pdfFilename: filename },
    });
  }
}
