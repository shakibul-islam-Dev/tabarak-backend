import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GuestId } from '../common/decorators/guest-id.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AuthUser } from '../auth/auth.types';
import { CartService } from './cart.service';
import { AddCartItemDto, MergeCartDto, UpdateCartItemDto } from './dto/cart.dto';

@OptionalAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user?: AuthUser, @GuestId() guestId?: string) {
    return this.cartService.getCart(user, guestId);
  }

  @Post('items')
  @ResponseMessage('Item added to cart')
  addItem(
    @Body() dto: AddCartItemDto,
    @CurrentUser() user?: AuthUser,
    @GuestId() guestId?: string,
  ) {
    return this.cartService.addItem(dto, user, guestId);
  }

  @Patch('items/:itemId')
  @ResponseMessage('Cart item updated')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user?: AuthUser,
    @GuestId() guestId?: string,
  ) {
    return this.cartService.updateItem(itemId, dto, user, guestId);
  }

  @Delete('items/:itemId')
  @ResponseMessage('Cart item removed')
  removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user?: AuthUser,
    @GuestId() guestId?: string,
  ) {
    return this.cartService.removeItem(itemId, user, guestId);
  }

  @Delete()
  @ResponseMessage('Cart cleared')
  clear(@CurrentUser() user?: AuthUser, @GuestId() guestId?: string) {
    return this.cartService.clear(user, guestId);
  }

  @Post('merge')
  @ResponseMessage('Guest cart merged successfully')
  merge(@Body() dto: MergeCartDto, @CurrentUser() user: AuthUser) {
    return this.cartService.mergeGuestCartForUser(user, dto.guestId);
  }
}
