import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CustomerStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const CUSTOMER_SORT_FIELDS = ['createdAt', 'updatedAt'] as const;

export class AdminCustomerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsIn(CUSTOMER_SORT_FIELDS)
  sortBy?: (typeof CUSTOMER_SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  marketingOptIn?: boolean;
}

export class UpdateCustomerStatusDto {
  @IsEnum(CustomerStatus)
  status!: CustomerStatus;
}
