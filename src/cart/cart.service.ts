import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CartStatus, Prisma, ProductStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          inventory: true,
          images: { orderBy: { sortOrder: 'asc' as const } },
          product: {
            include: {
              images: { orderBy: { sortOrder: 'asc' as const } },
              categories: { select: { categoryId: true } },
              collections: { select: { collectionId: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

type CartPayload = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export type CartEntity = CartPayload;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(user?: AuthUser, guestId?: string) {
    const cart = await this.resolveCart(user, guestId, false);
    return this.toResponse(cart);
  }

  /**
   * Returns the raw cart entity (with variant, inventory and product scopes).
   * Used by checkout and coupon calculation where server-side pricing data is
   * required. Never expose this entity directly to clients.
   */
  async getCartEntity(user?: AuthUser, guestId?: string): Promise<CartEntity> {
    return this.resolveCart(user, guestId, true);
  }

  async addItem(dto: AddCartItemDto, user?: AuthUser, guestId?: string) {
    const cart = await this.resolveCart(user, guestId, true);
    const variant = await this.getPurchasableVariant(dto.variantId);

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    });
    const requestedQuantity = (existing?.quantity ?? 0) + dto.quantity;

    this.assertStock(variant, requestedQuantity);

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: requestedQuantity,
          priceSnapshot: variant.price,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: variant.id,
          quantity: dto.quantity,
          priceSnapshot: variant.price,
        },
      });
    }

    return this.getCart(user, guestId);
  }

  async updateItem(itemId: string, dto: UpdateCartItemDto, user?: AuthUser, guestId?: string) {
    const cart = await this.resolveCart(user, guestId, true);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { variant: { include: { inventory: true } } },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (dto.quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
      return this.getCart(user, guestId);
    }

    this.assertStock(item.variant, dto.quantity);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity, priceSnapshot: item.variant.price },
    });

    return this.getCart(user, guestId);
  }

  async removeItem(itemId: string, user?: AuthUser, guestId?: string) {
    const cart = await this.resolveCart(user, guestId, true);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    return this.getCart(user, guestId);
  }

  async clear(user?: AuthUser, guestId?: string) {
    const cart = await this.resolveCart(user, guestId, true);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(user, guestId);
  }

  async mergeGuestCartForUser(user: AuthUser, guestId: string) {
    this.assertGuestId(guestId);
    const cart = await this.resolveCart(user, guestId, true);
    return this.toResponse(cart);
  }

  private async resolveCart(
    user: AuthUser | undefined,
    guestId: string | undefined,
    createIfMissing: boolean,
  ): Promise<CartPayload> {
    const validGuestId = guestId ? this.validateGuestId(guestId) : undefined;

    if (user) {
      const profile = await this.prisma.customerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, wishlist: { create: {} } },
        select: { id: true },
      });

      if (validGuestId) {
        await this.mergeGuestCart(profile.id, validGuestId);
      }

      let cart = await this.prisma.cart.findFirst({
        where: { customerId: profile.id, status: CartStatus.ACTIVE },
        include: cartInclude,
      });

      if (!cart && createIfMissing) {
        cart = await this.prisma.cart.create({
          data: { customerId: profile.id },
          include: cartInclude,
        });
      }

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { customerId: profile.id },
          include: cartInclude,
        });
      }

      return cart;
    }

    if (!validGuestId) {
      throw new BadRequestException(
        'Guest cart identifier is required. Send the x-guest-id header.',
      );
    }

    let cart = await this.prisma.cart.findFirst({
      where: { guestId: validGuestId, status: CartStatus.ACTIVE },
      include: cartInclude,
    });

    if (!cart && createIfMissing) {
      cart = await this.prisma.cart.create({
        data: { guestId: validGuestId },
        include: cartInclude,
      });
    }

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { guestId: validGuestId },
        include: cartInclude,
      });
    }

    return cart;
  }

  private async mergeGuestCart(customerId: string, guestId: string): Promise<void> {
    const guestCart = await this.prisma.cart.findFirst({
      where: { guestId, status: CartStatus.ACTIVE },
      include: { items: true },
    });

    if (!guestCart) {
      return;
    }

    const customerCart =
      (await this.prisma.cart.findFirst({
        where: { customerId, status: CartStatus.ACTIVE },
        select: { id: true },
      })) ??
      (await this.prisma.cart.create({
        data: { customerId },
        select: { id: true },
      }));

    await this.prisma.$transaction(async (tx) => {
      for (const item of guestCart.items) {
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_variantId: {
              cartId: customerCart.id,
              variantId: item.variantId,
            },
          },
        });

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: {
              quantity: Math.min(99, existing.quantity + item.quantity),
              priceSnapshot: item.priceSnapshot,
            },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: customerCart.id,
              variantId: item.variantId,
              quantity: item.quantity,
              priceSnapshot: item.priceSnapshot,
            },
          });
        }
      }

      await tx.cart.update({
        where: { id: guestCart.id },
        data: { status: CartStatus.CONVERTED },
      });
    });
  }

  private async getPurchasableVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true, product: { select: { status: true, name: true } } },
    });

    if (!variant || !variant.isActive) {
      throw new NotFoundException('Product variant not found');
    }

    if (variant.product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('This product is not available for purchase');
    }

    return variant;
  }

  private assertStock(
    variant: {
      name: string;
      inventory: { quantity: number; reservedQuantity: number; trackInventory: boolean } | null;
    },
    requestedQuantity: number,
  ): void {
    if (!variant.inventory || !variant.inventory.trackInventory) {
      return;
    }

    const available = Math.max(0, variant.inventory.quantity - variant.inventory.reservedQuantity);

    if (requestedQuantity > available) {
      throw new BadRequestException(
        available === 0
          ? `${variant.name} is out of stock`
          : `Only ${available} unit(s) of ${variant.name} are available`,
      );
    }
  }

  private validateGuestId(guestId: string): string {
    if (!UUID_PATTERN.test(guestId)) {
      throw new BadRequestException('x-guest-id must be a valid UUID');
    }

    return guestId;
  }

  private assertGuestId(guestId: string): void {
    this.validateGuestId(guestId);
  }

  private toResponse(cart: CartPayload) {
    let subtotal = new Prisma.Decimal(0);
    let totalQuantity = 0;

    const items = cart.items.map((item) => {
      const variant = item.variant;
      const inventory = variant.inventory;
      const available =
        inventory && inventory.trackInventory
          ? Math.max(0, inventory.quantity - inventory.reservedQuantity)
          : null;
      const lineTotal = item.priceSnapshot.mul(item.quantity);
      subtotal = subtotal.plus(lineTotal);
      totalQuantity += item.quantity;

      const primaryImage =
        variant.images.find((image) => image.isPrimary) ??
        variant.images[0] ??
        variant.product.images.find((image) => image.isPrimary) ??
        variant.product.images[0] ??
        null;

      return {
        id: item.id,
        variantId: variant.id,
        quantity: item.quantity,
        priceSnapshot: item.priceSnapshot,
        unitPrice: variant.price,
        lineTotal: lineTotal.toFixed(2),
        priceChanged: !item.priceSnapshot.equals(variant.price),
        availableStock: available,
        inStock: available === null || available > 0,
        product: {
          id: variant.product.id,
          name: variant.product.name,
          slug: variant.product.slug,
          status: variant.product.status,
          primaryImage,
        },
        variant: {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          material: variant.material,
          style: variant.style,
          isActive: variant.isActive,
          images: variant.images,
        },
      };
    });

    return {
      id: cart.id,
      status: cart.status,
      currency: cart.currency,
      itemCount: items.length,
      totalQuantity,
      subtotal: subtotal.toFixed(2),
      items,
      updatedAt: cart.updatedAt,
    };
  }
}
