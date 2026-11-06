import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AdminCustomersService } from './admin-customers.service';
import { AdminCustomerQueryDto, UpdateCustomerStatusDto } from './dto/admin-customer.dto';

@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  findAll(@Query() query: AdminCustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @ResponseMessage('Customer status updated successfully')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @CurrentUser('id') actorUserId: string,
  ) {
    return this.customersService.updateStatus(id, dto.status, actorUserId);
  }
}
