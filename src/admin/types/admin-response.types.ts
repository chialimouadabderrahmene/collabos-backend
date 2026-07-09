import { ApiProperty } from '@nestjs/swagger';
import {
  ModerationAction,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

export class DashboardResponse {
  @ApiProperty()
  totalUsers!: number;

  @ApiProperty()
  activeUsers!: number;

  @ApiProperty()
  totalBrands!: number;

  @ApiProperty()
  verifiedBrands!: number;

  @ApiProperty()
  totalOrders!: number;

  @ApiProperty()
  totalRevenue!: number;

  @ApiProperty()
  totalDeals!: number;

  @ApiProperty()
  activeDeals!: number;

  @ApiProperty()
  pendingModerationCount!: number;

  @ApiProperty()
  currency!: string;
}

export class AdminUserResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedAdminUsersResponse {
  @ApiProperty({ type: [AdminUserResponse] })
  data!: AdminUserResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class AdminBrandResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  followersCount!: number;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedAdminBrandsResponse {
  @ApiProperty({ type: [AdminBrandResponse] })
  data!: AdminBrandResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class GrowthReportPointResponse {
  @ApiProperty()
  period!: string;

  @ApiProperty()
  newUsers!: number;

  @ApiProperty()
  newBrands!: number;

  @ApiProperty()
  newOrders!: number;

  @ApiProperty()
  revenue!: number;
}

export class GrowthReportResponse {
  @ApiProperty({ nullable: true })
  periodFrom!: Date | null;

  @ApiProperty({ nullable: true })
  periodTo!: Date | null;

  @ApiProperty()
  totalNewUsers!: number;

  @ApiProperty()
  totalNewBrands!: number;

  @ApiProperty()
  totalNewOrders!: number;

  @ApiProperty()
  totalRevenue!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: [GrowthReportPointResponse] })
  series!: GrowthReportPointResponse[];
}

export class ContentReportResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  reporterId!: string;

  @ApiProperty({ enum: ReportTargetType })
  targetType!: ReportTargetType;

  @ApiProperty()
  targetId!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ nullable: true })
  details!: string | null;

  @ApiProperty({ enum: ReportStatus })
  status!: ReportStatus;

  @ApiProperty({ nullable: true })
  reviewedById!: string | null;

  @ApiProperty({ enum: ModerationAction, nullable: true })
  actionTaken!: ModerationAction | null;

  @ApiProperty({ nullable: true })
  resolutionNotes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  reviewedAt!: Date | null;
}

export class PaginatedContentReportsResponse {
  @ApiProperty({ type: [ContentReportResponse] })
  data!: ContentReportResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class PlatformSettingsResponse {
  @ApiProperty()
  maintenanceMode!: boolean;

  @ApiProperty()
  newSignupsEnabled!: boolean;

  @ApiProperty({ nullable: true })
  announcementBanner!: string | null;

  @ApiProperty()
  updatedAt!: Date;
}

export class AuditLogResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  userId!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedAuditLogsResponse {
  @ApiProperty({ type: [AuditLogResponse] })
  data!: AuditLogResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}

export class PermissionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class RoleResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty()
  createdAt!: Date;
}
