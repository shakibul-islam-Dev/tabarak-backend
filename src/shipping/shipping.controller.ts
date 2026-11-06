import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ShippingMethodsQueryDto } from './dto/shipping.dto';
import { ShippingService } from './shipping.service';

@Public()
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('methods')
  findMethods(@Query() query: ShippingMethodsQueryDto) {
    return this.shippingService.findMethods(query.country);
  }
}
