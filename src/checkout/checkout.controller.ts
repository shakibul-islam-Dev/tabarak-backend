import { Body, Controller, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GuestId } from '../common/decorators/guest-id.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CheckoutService } from './checkout.service';
import { CheckoutDto, CheckoutPreviewDto } from '../orders/dto/order.dto';

@OptionalAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('preview')
  preview(
    @Body() dto: CheckoutPreviewDto,
    @CurrentUser() user?: AuthUser,
    @GuestId() guestId?: string,
  ) {
    return this.checkoutService.preview(user, guestId, dto);
  }

  @Post()
  @ResponseMessage('Order placed successfully')
  createOrder(
    @Body() dto: CheckoutDto,
    @CurrentUser() user?: AuthUser,
    @GuestId() guestId?: string,
  ) {
    return this.checkoutService.createOrder(user, guestId, dto);
  }
}
