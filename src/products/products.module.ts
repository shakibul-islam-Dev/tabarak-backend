import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SearchController } from './search.controller';

@Module({
  controllers: [ProductsController, SearchController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
