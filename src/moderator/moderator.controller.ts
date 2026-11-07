import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { DashboardService } from '../admin/dashboard.service';
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
} from '../orders/dto/order.dto';
import { OrdersService } from '../orders/orders.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { AdminProductQueryDto } from '../products/dto/product-query.dto';
import {
  AddVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from '../products/dto/update-product.dto';
import { ProductsService } from '../products/products.service';

/**
 * Moderator-facing API. Access is permission based, so a moderator only sees
 * the operations granted by their assigned role.
 */
@Controller('moderator/dashboard')
export class ModeratorDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  getSummary() {
    return this.dashboardService.getSummary();
  }
}

@Controller('moderator/products')
export class ModeratorProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  findAll(@Query() query: AdminProductQueryDto) {
    return this.productsService.findAll(query, false);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  findOne(@Param('id') id: string) {
    return this.productsService.findAdminById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product created successfully')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product archived successfully')
  archive(@Param('id') id: string) {
    return this.productsService.archive(id);
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product published successfully')
  publish(@Param('id') id: string) {
    return this.productsService.setStatus(id, 'ACTIVE');
  }

  @Post(':id/unpublish')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product unpublished successfully')
  unpublish(@Param('id') id: string) {
    return this.productsService.setStatus(id, 'DRAFT');
  }

  @Post(':id/feature')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product featured successfully')
  feature(@Param('id') id: string) {
    return this.productsService.setFeatured(id, true);
  }

  @Post(':id/unfeature')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product removed from featured successfully')
  unfeature(@Param('id') id: string) {
    return this.productsService.setFeatured(id, false);
  }

  @Post(':id/variants')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Variant created successfully')
  addVariant(@Param('id') id: string, @Body() dto: AddVariantDto) {
    return this.productsService.addVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Variant updated successfully')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Variant deleted successfully')
  deleteVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.productsService.deleteVariant(id, variantId);
  }
}

@Controller('moderator/orders')
export class ModeratorOrdersController {
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
      dto.reason ?? 'Cancelled by moderator',
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
