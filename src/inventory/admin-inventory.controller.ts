import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  InventoryQueryDto,
  MovementQueryDto,
  ReleaseExpiredReservationsDto,
  UpdateStockDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  list(@Query() query: InventoryQueryDto) {
    return this.inventoryService.list(query);
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  listMovements(@Query() query: MovementQueryDto) {
    return this.inventoryService.listMovements(query.variantId, query.page, query.limit);
  }

  @Post('reservations/release-expired')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @ResponseMessage('Expired reservations released successfully')
  releaseExpired(@Query() query: ReleaseExpiredReservationsDto, @CurrentUser('id') userId: string) {
    return this.inventoryService.releaseExpiredReservations(query.limit, userId);
  }

  @Get(':variantId')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  getOne(@Param('variantId') variantId: string) {
    return this.inventoryService.getByVariantId(variantId);
  }

  @Patch(':variantId')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @ResponseMessage('Stock updated successfully')
  update(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateStockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventoryService.updateStock(variantId, dto, userId);
  }
}
