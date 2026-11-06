import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { AdminCollectionsController } from './admin-collections.controller';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [ProductsModule],
  controllers: [CollectionsController, AdminCollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
