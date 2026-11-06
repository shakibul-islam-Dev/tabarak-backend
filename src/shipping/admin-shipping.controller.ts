import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  CreateShippingMethodDto,
  CreateShippingZoneDto,
  UpdateShippingMethodDto,
  UpdateShippingZoneDto,
} from './dto/shipping.dto';
import { ShippingService } from './shipping.service';

@Controller('admin/shipping')
export class AdminShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('zones')
  @RequirePermissions(PERMISSIONS.SHIPPING_MANAGE)
  findZones() {
    return this.shippingService.findZones();
  }

  @Post('zones')
  @RequirePermissions(PERMISSIONS.SHIPPING_MANAGE)
  @ResponseMessage('Shipping zone created successfully')
  createZone(@Body() dto: CreateShippingZoneDto) {
    return this.shippingService.createZone(dto);
  }

  @Patch('zones/:id')
  @RequirePermissions(PERMISSIONS.SHIPPING_MANAGE)
  @ResponseMessage('Shipping zone updated successfully')
  updateZone(@Param('id') id: string, @Body() dto: UpdateShippingZoneDto) {
    return this.shippingService.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @RequirePermissions(PERMISSIONS.SHIPPING_MANAGE)
  @ResponseMessage('Shipping zone deleted successfully')
  removeZone(@Param('id') id: string) {
    return this.shippingService.removeZone(id);
  }

  @Get('methods')
  @RequirePermissions(PERMISSIONS.SHIPPING_MANAGE)
  findMethods() {
    return this.shippingService.findAdminMethods();
  }

  @Post('methods')
  @RequirePermissions(PERMISSIONS.SHIPPING_MANAGE)
  @ResponseMessage('Shipping method created successfully')
  createMethod(@Body() dto: CreateShippingMethodDto) {
    return this.shippingService.createMethod(dto);
  }

  @Patch('methods/:id')
  @RequirePermissions(PERMISSIONS.SHIPPING_MANAGE)
  @ResponseMessage('Shipping method updated successfully')
  updateMethod(@Param('id') id: string, @Body() dto: UpdateShippingMethodDto) {
    return this.shippingService.updateMethod(id, dto);
  }

  @Delete('methods/:id')
  @RequirePermissions(PERMISSIONS.SHIPPING_MANAGE)
  @ResponseMessage('Shipping method deleted successfully')
  removeMethod(@Param('id') id: string) {
    return this.shippingService.removeMethod(id);
  }
}
