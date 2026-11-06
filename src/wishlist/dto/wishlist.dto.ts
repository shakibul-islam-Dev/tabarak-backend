import { IsArray, IsString } from 'class-validator';

export class AddWishlistItemDto {
  @IsString()
  productId!: string;
}

export class SyncWishlistDto {
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];
}
