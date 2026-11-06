import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { AdminCouponsController, CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  imports: [CartModule],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
