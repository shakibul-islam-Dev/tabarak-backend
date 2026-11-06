import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GuestId } from '../common/decorators/guest-id.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CouponsService } from './coupons.service';
import {
  AdminCouponQueryDto,
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
} from './dto/coupon.dto';

@OptionalAuth()
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('validate')
  validate(
    @Body() dto: ValidateCouponDto,
    @CurrentUser() user?: AuthUser,
    @GuestId() guestId?: string,
  ) {
    return this.couponsService.validateForCart(user, guestId, dto.code);
  }
}

@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COUPONS_MANAGE)
  findAll(@Query() query: AdminCouponQueryDto) {
    return this.couponsService.findAllAdmin(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.COUPONS_MANAGE)
  findOne(@Param('id') id: string) {
    return this.couponsService.findAdminById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COUPONS_MANAGE)
  @ResponseMessage('Coupon created successfully')
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.COUPONS_MANAGE)
  @ResponseMessage('Coupon updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.COUPONS_MANAGE)
  @ResponseMessage('Coupon deleted successfully')
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
