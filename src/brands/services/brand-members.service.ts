import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BrandMember, BrandMemberRole, User } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddBrandMemberDto,
  UpdateBrandMemberDto,
} from '../dto/brand-member.dto';
import { MessageResponse } from '../types/brand-response.types';
import { toBrandResponse } from '../mappers/brand.mapper';
import {
  BrandMemberResponse,
  MyBrandResponse,
} from '../types/brand-member-response.types';
import { brandRoleAtLeast } from '../utils/brand-role.util';
import { BrandAccess, BrandAccessService } from './brand-access.service';

type MemberWithUser = BrandMember & {
  user: Pick<User, 'email' | 'displayName'>;
};

const MEMBER_USER_SELECT = { email: true, displayName: true } as const;

/**
 * Brand team management. Rules:
 * - any member can list the team;
 * - ADMIN+ manages members; only an OWNER can grant, change or remove the
 *   OWNER/ADMIN roles;
 * - the brand's legal owner (`Brand.ownerId`) can never be demoted or removed;
 * - any member (except the legal owner) may leave.
 * Non-members get a 404 so brand IDs cannot be probed.
 */
@Injectable()
export class BrandMembersService {
  private readonly logger = new Logger(BrandMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandAccess: BrandAccessService,
  ) {}

  /**
   * Active brands the user belongs to (as legal owner or team member), with
   * their effective role — the entry point for brand-scoped workspaces.
   */
  async findMine(user: AuthenticatedUser): Promise<MyBrandResponse[]> {
    const brands = await this.prisma.brand.findMany({
      where: {
        isActive: true,
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      include: {
        profile: true,
        categories: true,
        members: { where: { userId: user.id }, select: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return brands.map(({ members, ...brand }) => ({
      ...toBrandResponse(brand),
      role:
        brand.ownerId === user.id
          ? BrandMemberRole.OWNER
          : (members[0]?.role ?? BrandMemberRole.VIEWER),
    }));
  }

  async list(
    brandId: string,
    user: AuthenticatedUser,
  ): Promise<BrandMemberResponse[]> {
    const access = await this.requireAccess(brandId, user);

    const members = await this.prisma.brandMember.findMany({
      where: { brandId },
      include: { user: { select: MEMBER_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => this.toResponse(member, access.ownerId));
  }

  async add(
    brandId: string,
    user: AuthenticatedUser,
    dto: AddBrandMemberDto,
  ): Promise<BrandMemberResponse> {
    const access = await this.requireAccess(brandId, user);
    this.assertCanAssign(access, dto.role);

    const target = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
      select: { id: true, isActive: true },
    });

    if (!target || !target.isActive) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.brandMember.findUnique({
      where: { brandId_userId: { brandId, userId: target.id } },
    });

    if (existing || target.id === access.ownerId) {
      throw new ConflictException('User is already a member of this brand');
    }

    const member = await this.prisma.brandMember.create({
      data: { brandId, userId: target.id, role: dto.role },
      include: { user: { select: MEMBER_USER_SELECT } },
    });

    this.logger.log(
      `Brand member added brand=${brandId} user=${target.id} role=${dto.role} by=${user.id}`,
    );

    return this.toResponse(member, access.ownerId);
  }

  async updateRole(
    brandId: string,
    memberUserId: string,
    user: AuthenticatedUser,
    dto: UpdateBrandMemberDto,
  ): Promise<BrandMemberResponse> {
    const access = await this.requireAccess(brandId, user);
    const member = await this.findMember(brandId, memberUserId);

    this.assertNotLegalOwner(access, memberUserId);
    this.assertCanAssign(access, member.role);
    this.assertCanAssign(access, dto.role);

    const updated = await this.prisma.brandMember.update({
      where: { id: member.id },
      data: { role: dto.role },
      include: { user: { select: MEMBER_USER_SELECT } },
    });

    this.logger.log(
      `Brand member role changed brand=${brandId} user=${memberUserId} role=${dto.role} by=${user.id}`,
    );

    return this.toResponse(updated, access.ownerId);
  }

  async remove(
    brandId: string,
    memberUserId: string,
    user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    const access = await this.requireAccess(brandId, user);
    const member = await this.findMember(brandId, memberUserId);

    this.assertNotLegalOwner(access, memberUserId);

    if (memberUserId !== user.id) {
      this.assertCanAssign(access, member.role);
    }

    await this.prisma.brandMember.delete({ where: { id: member.id } });

    this.logger.log(
      `Brand member removed brand=${brandId} user=${memberUserId} by=${user.id}`,
    );

    return { message: 'Member removed' };
  }

  private async requireAccess(
    brandId: string,
    user: AuthenticatedUser,
  ): Promise<BrandAccess> {
    const access = await this.brandAccess.resolve(brandId, user.id);
    if (!access) {
      throw new NotFoundException('Brand not found');
    }
    return access;
  }

  private async findMember(
    brandId: string,
    userId: string,
  ): Promise<BrandMember> {
    const member = await this.prisma.brandMember.findUnique({
      where: { brandId_userId: { brandId, userId } },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  /** Actor must be ADMIN+, and only OWNERs may touch OWNER/ADMIN roles. */
  private assertCanAssign(access: BrandAccess, role: BrandMemberRole): void {
    if (!brandRoleAtLeast(access.role, BrandMemberRole.ADMIN)) {
      throw new ForbiddenException('Only brand admins can manage members');
    }

    if (
      brandRoleAtLeast(role, BrandMemberRole.ADMIN) &&
      access.role !== BrandMemberRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only brand owners can manage owner or admin roles',
      );
    }
  }

  private assertNotLegalOwner(access: BrandAccess, userId: string): void {
    if (userId === access.ownerId) {
      throw new ForbiddenException(
        'The brand owner cannot be demoted or removed',
      );
    }
  }

  private toResponse(
    member: MemberWithUser,
    ownerId: string,
  ): BrandMemberResponse {
    return {
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      role: member.role,
      isBrandOwner: member.userId === ownerId,
      createdAt: member.createdAt,
    };
  }
}
