import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';

@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findPublic(query);
  }

  @Get('featured')
  findFeatured(@Query() query: ProductQueryDto) {
    return this.productsService.findFeatured(query);
  }

  @Get('new-arrivals')
  findNewArrivals(@Query() query: ProductQueryDto) {
    return this.productsService.findNewArrivals(query);
  }

  @Get('best-sellers')
  findBestSellers(@Query() query: ProductQueryDto) {
    return this.productsService.findBestSellers(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.productsService.findPublicBySlug(slug);
  }
}
