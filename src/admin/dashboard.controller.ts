import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
