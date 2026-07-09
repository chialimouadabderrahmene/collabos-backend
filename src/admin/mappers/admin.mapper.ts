import {
  AuditLog,
  Brand,
  ContentReport,
  Permission,
  PlatformSettings,
  Role,
  User,
} from '@prisma/client';
import {
  AdminBrandResponse,
  AdminUserResponse,
  AuditLogResponse,
  ContentReportResponse,
  PermissionResponse,
  PlatformSettingsResponse,
  RoleResponse,
} from '../types/admin-response.types';

export function toAdminUserResponse(
  user: User & { roles: Role[] },
): AdminUserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isActive: user.isActive,
    roles: user.roles.map((role) => role.name),
    createdAt: user.createdAt,
  };
}

export function toAdminBrandResponse(brand: Brand): AdminBrandResponse {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    ownerId: brand.ownerId,
    isVerified: brand.isVerified,
    isActive: brand.isActive,
    followersCount: brand.followersCount,
    createdAt: brand.createdAt,
  };
}

export function toContentReportResponse(
  report: ContentReport,
): ContentReportResponse {
  return {
    id: report.id,
    reporterId: report.reporterId,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    reviewedById: report.reviewedById,
    actionTaken: report.actionTaken,
    resolutionNotes: report.resolutionNotes,
    createdAt: report.createdAt,
    reviewedAt: report.reviewedAt,
  };
}

export function toPlatformSettingsResponse(
  settings: PlatformSettings,
): PlatformSettingsResponse {
  return {
    maintenanceMode: settings.maintenanceMode,
    newSignupsEnabled: settings.newSignupsEnabled,
    announcementBanner: settings.announcementBanner,
    updatedAt: settings.updatedAt,
  };
}

export function toAuditLogResponse(log: AuditLog): AuditLogResponse {
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt,
  };
}

export function toPermissionResponse(
  permission: Permission,
): PermissionResponse {
  return { id: permission.id, name: permission.name };
}

export function toRoleResponse(
  role: Role & { permissions: Permission[] },
): RoleResponse {
  return {
    id: role.id,
    name: role.name,
    permissions: role.permissions.map((permission) => permission.name),
    createdAt: role.createdAt,
  };
}
