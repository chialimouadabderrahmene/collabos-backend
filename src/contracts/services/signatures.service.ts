import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AgreementStatus, ContractEventType, DealParty } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { SignContractDto } from '../dto/sign-contract.dto';
import { toSignatureResponse } from '../mappers/contract.mapper';
import { SignatureResponse } from '../types/contract-response.types';
import { ContractEventsService } from './contract-events.service';
import { ContractsService } from './contracts.service';

const SIGNABLE_STATUSES: AgreementStatus[] = [
  AgreementStatus.AWAITING_SIGNATURE,
  AgreementStatus.PARTIALLY_SIGNED,
];

@Injectable()
export class SignaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
    private readonly eventsService: ContractEventsService,
  ) {}

  async sign(
    contractId: string,
    user: AuthenticatedUser,
    dto: SignContractDto,
    ipAddress?: string,
  ): Promise<SignatureResponse> {
    const contract = await this.contractsService.findEntityOrThrow(contractId);
    await this.contractsService.assertParticipant(contract, user);

    if (!SIGNABLE_STATUSES.includes(contract.status)) {
      throw new ConflictException(
        'This contract is not currently awaiting signatures',
      );
    }

    const party = await this.resolveParty(
      contract.brandId,
      contract.creatorId,
      user,
    );
    const version =
      await this.contractsService.getLatestVersionEntity(contractId);

    const existing = await this.prisma.contractSignature.findUnique({
      where: {
        contractVersionId_party: {
          contractVersionId: version.id,
          party,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'This party has already signed the current version',
      );
    }

    const signature = await this.prisma.contractSignature.create({
      data: {
        contractVersionId: version.id,
        signerId: user.id,
        party,
        signedName: dto.signedName,
        ipAddress,
      },
    });

    const signatureCount = await this.prisma.contractSignature.count({
      where: { contractVersionId: version.id },
    });

    if (signatureCount >= 2) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: AgreementStatus.EXECUTED, executedAt: new Date() },
      });
      await this.eventsService.record(
        contractId,
        ContractEventType.FULLY_EXECUTED,
        user.id,
      );
    } else {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: AgreementStatus.PARTIALLY_SIGNED },
      });
      await this.eventsService.record(
        contractId,
        ContractEventType.SIGNED,
        user.id,
        { party },
      );
    }

    return toSignatureResponse(signature);
  }

  async findAll(
    contractId: string,
    user: AuthenticatedUser,
  ): Promise<SignatureResponse[]> {
    const contract = await this.contractsService.findEntityOrThrow(contractId);
    await this.contractsService.assertParticipant(contract, user);

    const version =
      await this.contractsService.getLatestVersionEntity(contractId);

    const signatures = await this.prisma.contractSignature.findMany({
      where: { contractVersionId: version.id },
      orderBy: { signedAt: 'asc' },
    });

    return signatures.map((signature) => toSignatureResponse(signature));
  }

  private async resolveParty(
    brandId: string,
    creatorId: string,
    user: AuthenticatedUser,
  ): Promise<DealParty> {
    if (user.id === creatorId) {
      return DealParty.CREATOR;
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (brand?.ownerId === user.id) {
      return DealParty.BRAND;
    }

    throw new ForbiddenException(
      'Only the brand owner or the creator may sign this contract',
    );
  }
}
