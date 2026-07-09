import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DealStatus, ProposalStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProposalDto } from '../dto/create-proposal.dto';
import { toProposalResponse } from '../mappers/deal.mapper';
import { ProposalResponse } from '../types/deal-response.types';
import { DealsService } from './deals.service';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dealsService: DealsService,
  ) {}

  async create(
    dealId: string,
    user: AuthenticatedUser,
    dto: CreateProposalDto,
  ): Promise<ProposalResponse> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);
    this.dealsService.assertValidSplit(
      dto.revenueSplitBrand,
      dto.revenueSplitCreator,
    );

    if (deal.status !== DealStatus.NEGOTIATING) {
      throw new ConflictException('This deal is no longer under negotiation');
    }

    await this.prisma.dealProposal.updateMany({
      where: { dealId, status: ProposalStatus.PENDING },
      data: { status: ProposalStatus.SUPERSEDED, respondedAt: new Date() },
    });

    const proposal = await this.prisma.dealProposal.create({
      data: {
        dealId,
        proposedById: user.id,
        totalValue: dto.totalValue,
        revenueSplitBrand: dto.revenueSplitBrand,
        revenueSplitCreator: dto.revenueSplitCreator,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        message: dto.message,
      },
    });

    return toProposalResponse(proposal);
  }

  async findAll(
    dealId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalResponse[]> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    const proposals = await this.prisma.dealProposal.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });

    return proposals.map((proposal) => toProposalResponse(proposal));
  }

  async accept(
    dealId: string,
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalResponse> {
    const proposal = await this.decide(dealId, proposalId, user);

    const updatedProposal = await this.prisma.dealProposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.ACCEPTED, respondedAt: new Date() },
    });

    await this.prisma.deal.update({
      where: { id: dealId },
      data: {
        status: DealStatus.ACTIVE,
        activatedAt: new Date(),
        totalValue: proposal.totalValue ?? undefined,
        revenueSplitBrand: proposal.revenueSplitBrand ?? undefined,
        revenueSplitCreator: proposal.revenueSplitCreator ?? undefined,
        startDate: proposal.startDate ?? undefined,
        endDate: proposal.endDate ?? undefined,
      },
    });

    return toProposalResponse(updatedProposal);
  }

  async reject(
    dealId: string,
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalResponse> {
    await this.decide(dealId, proposalId, user);

    const updatedProposal = await this.prisma.dealProposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.REJECTED, respondedAt: new Date() },
    });

    return toProposalResponse(updatedProposal);
  }

  private async decide(
    dealId: string,
    proposalId: string,
    user: AuthenticatedUser,
  ) {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    if (deal.status !== DealStatus.NEGOTIATING) {
      throw new ConflictException('This deal is no longer under negotiation');
    }

    const proposal = await this.prisma.dealProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || proposal.dealId !== dealId) {
      throw new ConflictException('Proposal not found for this deal');
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ConflictException('Only pending proposals can be decided');
    }

    if (proposal.proposedById === user.id) {
      throw new ForbiddenException(
        'You cannot accept or reject your own proposal',
      );
    }

    return proposal;
  }
}
