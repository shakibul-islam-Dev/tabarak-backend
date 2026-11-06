import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  CancelOrderDto,
  CreateShipmentDto,
  OrderQueryDto,
  UpdateOrderStatusDto,
  UpdateShipmentDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findForAdmin(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  findOne(@Param('id') id: string) {
    return this.ordersService.findOneForAdmin(id);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ResponseMessage('Order status updated successfully')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.updateStatus(id, dto.status, userId, dto.note);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ResponseMessage('Order cancelled successfully')
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @CurrentUser('id') userId: string) {
    return this.ordersService.updateStatus(
      id,
      OrderStatus.CANCELLED,
      userId,
      dto.reason ?? 'Cancelled by administrator',
    );
  }

  @Post(':id/shipments')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ResponseMessage('Shipment created successfully')
  createShipment(@Param('id') id: string, @Body() dto: CreateShipmentDto) {
    return this.ordersService.createShipment(id, dto);
  }

  @Patch(':id/shipments/:shipmentId')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ResponseMessage('Shipment updated successfully')
  updateShipment(
    @Param('id') id: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.ordersService.updateShipment(id, shipmentId, dto);
  }
}
