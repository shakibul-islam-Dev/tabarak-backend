import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { AdminProductQueryDto } from './dto/product-query.dto';
import { AddVariantDto, UpdateProductDto, UpdateVariantDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  findAll(@Query() query: AdminProductQueryDto) {
    return this.productsService.findAll(query, false);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  findOne(@Param('id') id: string) {
    return this.productsService.findAdminById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product created successfully')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product archived successfully')
  archive(@Param('id') id: string) {
    return this.productsService.archive(id);
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product published successfully')
  publish(@Param('id') id: string) {
    return this.productsService.setStatus(id, 'ACTIVE');
  }

  @Post(':id/unpublish')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product unpublished successfully')
  unpublish(@Param('id') id: string) {
    return this.productsService.setStatus(id, 'DRAFT');
  }

  @Post(':id/feature')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product featured successfully')
  feature(@Param('id') id: string) {
    return this.productsService.setFeatured(id, true);
  }

  @Post(':id/unfeature')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Product removed from featured successfully')
  unfeature(@Param('id') id: string) {
    return this.productsService.setFeatured(id, false);
  }

  @Post(':id/variants')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Variant created successfully')
  addVariant(@Param('id') id: string, @Body() dto: AddVariantDto) {
    return this.productsService.addVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Variant updated successfully')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ResponseMessage('Variant deleted successfully')
  deleteVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.productsService.deleteVariant(id, variantId);
  }
}
