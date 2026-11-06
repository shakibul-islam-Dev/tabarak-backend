import { Controller, Get, Param, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { CollectionsService } from './collections.service';
import { CollectionQueryDto } from './dto/collection.dto';

class PublicCollectionQueryDto extends CollectionQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  featured?: boolean;
}

@Public()
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  findPublished(@Query() query: PublicCollectionQueryDto) {
    return this.collectionsService.findPublished(query.featured);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string, @Query() query: CollectionQueryDto) {
    return this.collectionsService.findPublicBySlug(slug, query);
  }
}
