import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

const wishlistInclude = {
  items: {
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: 'asc' as const } },
          variants: {
            where: { isActive: true },
            include: { inventory: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.WishlistInclude;

type WishlistPayload = Prisma.WishlistGetPayload<{ include: typeof wishlistInclude }>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(user: AuthUser) {
    const wishlist = await this.ensureWishlist(user.id);
    return this.toResponse(wishlist);
  }

  async addItem(user: AuthUser, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const wishlist = await this.ensureWishlist(user.id);

    await this.prisma.wishlistItem.upsert({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
      update: {},
      create: {
        wishlistId: wishlist.id,
        productId,
      },
    });

    return this.getWishlist(user);
  }

  async removeItem(user: AuthUser, productId: string) {
    const wishlist = await this.ensureWishlist(user.id);

    await this.prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, productId },
    });

    return this.getWishlist(user);
  }

  async sync(user: AuthUser, productIds: string[]) {
    const wishlist = await this.ensureWishlist(user.id);
    const uniqueIds = Array.from(new Set(productIds));

    if (uniqueIds.length === 0) {
      return this.getWishlist(user);
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds }, status: ProductStatus.ACTIVE },
      select: { id: true },
    });

    await this.prisma.wishlistItem.createMany({
      data: products.map((product) => ({
        wishlistId: wishlist.id,
        productId: product.id,
      })),
      skipDuplicates: true,
    });

    return this.getWishlist(user);
  }

  async clear(user: AuthUser) {
    const wishlist = await this.ensureWishlist(user.id);
    await this.prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
    return this.getWishlist(user);
  }

  private async ensureWishlist(userId: string): Promise<WishlistPayload> {
    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, wishlist: { create: {} } },
      select: { id: true },
    });

    const existing = await this.prisma.wishlist.findUnique({
      where: { customerId: profile.id },
      include: wishlistInclude,
    });

    if (existing) {
      return existing;
    }

    return this.prisma.wishlist.create({
      data: { customerId: profile.id },
      include: wishlistInclude,
    });
  }

  private toResponse(wishlist: WishlistPayload) {
    return {
      id: wishlist.id,
      items: wishlist.items.map((item) => {
        const product = item.product;
        const prices = product.variants.map((variant) => Number(variant.price));
        const stock = product.variants.reduce((total, variant) => {
          if (!variant.inventory?.trackInventory) {
            return total;
          }
          return (
            total + Math.max(0, variant.inventory.quantity - variant.inventory.reservedQuantity)
          );
        }, 0);

        return {
          id: item.id,
          productId: product.id,
          addedAt: item.createdAt,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            basePrice: product.basePrice,
            compareAtPrice: product.compareAtPrice,
            status: product.status,
            primaryImage:
              product.images.find((image) => image.isPrimary) ?? product.images[0] ?? null,
            images: product.images,
            priceRange:
              prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
            inStock: product.variants.some((variant) => {
              if (!variant.inventory?.trackInventory) {
                return true;
              }
              return variant.inventory.quantity - variant.inventory.reservedQuantity > 0;
            }),
            totalAvailableStock: stock,
          },
        };
      }),
    };
  }
}
