import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateAddressDto } from '../../addresses/dto/address.dto';

export class CheckoutDto {
  @IsOptional()
  @IsString()
  addressId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAddressDto)
  shippingAddress?: CreateAddressDto;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  shippingMethodId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  couponCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CheckoutPreviewDto {
  @IsOptional()
  @IsString()
  shippingMethodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  couponCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  addressId?: string;
}

export class OrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}

export class UpdateShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}
