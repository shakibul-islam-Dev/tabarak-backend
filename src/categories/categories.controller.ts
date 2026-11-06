import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';

@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findTree() {
    return this.categoriesService.findTree(true);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.categoriesService.findPublicBySlug(slug);
  }
}
