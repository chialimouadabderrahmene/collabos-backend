import { Module } from '@nestjs/common';
import { AdminBrandsController } from './brands.controller';
import { AuditController } from './audit.controller';
import { DashboardController } from './dashboard.controller';
import { ModerationController } from './moderation.controller';
import { RbacController } from './rbac.controller';
import { AdminReportsController } from './reports.controller';
import { AdminBrandsService } from './services/admin-brands.service';
import { AdminUsersService } from './services/admin-users.service';
import { AuditService } from './services/audit.service';
import { DashboardService } from './services/dashboard.service';
import { ModerationService } from './services/moderation.service';
import { RbacService } from './services/rbac.service';
import { ReportsService } from './services/reports.service';
import { SettingsService } from './services/settings.service';
import { SettingsController } from './settings.controller';
import { AdminUsersController } from './users.controller';

@Module({
  controllers: [
    DashboardController,
    AdminUsersController,
    AdminBrandsController,
    AdminReportsController,
    ModerationController,
    SettingsController,
    AuditController,
    RbacController,
  ],
  providers: [
    DashboardService,
    AdminUsersService,
    AdminBrandsService,
    ReportsService,
    ModerationService,
    SettingsService,
    AuditService,
    RbacService,
  ],
})
export class AdminModule {}
