import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';

@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  search(@Query() query: ProductQueryDto) {
    return this.productsService.search(query);
  }
}
