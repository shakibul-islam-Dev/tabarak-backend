import { Body, Controller, Get, Param, Patch, Post, Delete } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  findAll() {
    return this.categoriesService.findAllFlat();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  findOne(@Param('id') id: string) {
    return this.categoriesService.findAdminById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  @ResponseMessage('Category created successfully')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  @ResponseMessage('Category updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  @ResponseMessage('Category deleted successfully')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
