import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { MeController } from './me.controller';

@Module({
  controllers: [CustomersController, MeController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
