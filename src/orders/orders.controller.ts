import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CancelOrderDto, OrderQueryDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: OrderQueryDto) {
    return this.ordersService.findForCustomer(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.findOneForCustomer(user, id);
  }

  @Post(':id/cancel')
  @ResponseMessage('Order cancelled successfully')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancelForCustomer(user, id, dto);
  }
}
