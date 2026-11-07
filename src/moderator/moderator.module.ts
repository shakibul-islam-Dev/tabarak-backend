import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import {
  ModeratorDashboardController,
  ModeratorOrdersController,
  ModeratorProductsController,
} from './moderator.controller';

@Module({
  imports: [AdminModule, ProductsModule, OrdersModule],
  controllers: [
    ModeratorDashboardController,
    ModeratorProductsController,
    ModeratorOrdersController,
  ],
})
export class ModeratorModule {}
