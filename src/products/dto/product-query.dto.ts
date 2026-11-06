import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return value;
};

export const PRODUCT_SORTS = [
  'newest',
  'oldest',
  'price-asc',
  'price-desc',
  'name-asc',
  'name-desc',
  'featured',
  'best-sellers',
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  maxPrice?: number;

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;
}

export class AdminProductQueryDto extends ProductQueryDto {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
