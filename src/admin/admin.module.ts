import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AdminSettingsController, SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuditModule],
  controllers: [
    DashboardController,
    AdminCustomersController,
    SettingsController,
    AdminSettingsController,
  ],
  providers: [DashboardService, AdminCustomersService, SettingsService],
  exports: [DashboardService],
})
export class AdminModule {}
