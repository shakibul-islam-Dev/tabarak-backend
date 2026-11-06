import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AddWishlistItemDto, SyncWishlistDto } from './dto/wishlist.dto';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getWishlist(@CurrentUser() user: AuthUser) {
    return this.wishlistService.getWishlist(user);
  }

  @Post('items')
  @ResponseMessage('Product added to wishlist')
  addItem(@CurrentUser() user: AuthUser, @Body() dto: AddWishlistItemDto) {
    return this.wishlistService.addItem(user, dto.productId);
  }

  @Delete('items/:productId')
  @ResponseMessage('Product removed from wishlist')
  removeItem(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.wishlistService.removeItem(user, productId);
  }

  @Post('sync')
  @ResponseMessage('Wishlist synchronized successfully')
  sync(@CurrentUser() user: AuthUser, @Body() dto: SyncWishlistDto) {
    return this.wishlistService.sync(user, dto.productIds);
  }

  @Delete()
  @ResponseMessage('Wishlist cleared')
  clear(@CurrentUser() user: AuthUser) {
    return this.wishlistService.clear(user);
  }
}
