import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CollectionsService } from './collections.service';
import {
  CollectionProductsDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from './dto/collection.dto';

@Controller('admin/collections')
export class AdminCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  findAll() {
    return this.collectionsService.findAllAdmin();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  findOne(@Param('id') id: string) {
    return this.collectionsService.findAdminById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  @ResponseMessage('Collection created successfully')
  create(@Body() dto: CreateCollectionDto) {
    return this.collectionsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  @ResponseMessage('Collection updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.collectionsService.update(id, dto);
  }

  @Put(':id/products')
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  @ResponseMessage('Collection products updated successfully')
  setProducts(@Param('id') id: string, @Body() dto: CollectionProductsDto) {
    return this.collectionsService.setProducts(id, dto.productIds);
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  @ResponseMessage('Collection published successfully')
  publish(@Param('id') id: string) {
    return this.collectionsService.setPublishState(id, true);
  }

  @Post(':id/unpublish')
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  @ResponseMessage('Collection unpublished successfully')
  unpublish(@Param('id') id: string) {
    return this.collectionsService.setPublishState(id, false);
  }

  @Post(':id/feature')
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  @ResponseMessage('Collection featured successfully')
  feature(@Param('id') id: string) {
    return this.collectionsService.setFeaturedState(id, true);
  }

  @Post(':id/unfeature')
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  @ResponseMessage('Collection removed from featured successfully')
  unfeature(@Param('id') id: string) {
    return this.collectionsService.setFeaturedState(id, false);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.COLLECTIONS_MANAGE)
  @ResponseMessage('Collection deleted successfully')
  remove(@Param('id') id: string) {
    return this.collectionsService.remove(id);
  }
}
