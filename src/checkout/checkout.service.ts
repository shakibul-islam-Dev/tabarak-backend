import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AddressType, OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CartEntity, CartService } from '../cart/cart.service';
import { CreateAddressDto } from '../addresses/dto/address.dto';
import { CouponsService, PricedLine } from '../coupons/coupons.service';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { ShippingService } from '../shipping/shipping.service';
import { randomSuffix } from '../common/utils/slug';
import { CheckoutDto, CheckoutPreviewDto } from '../orders/dto/order.dto';
import { OrdersService } from '../orders/orders.service';

interface CheckoutLine {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  categoryIds: string[];
  collectionIds: string[];
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly couponsService: CouponsService,
    private readonly shippingService: ShippingService,
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
  ) {}

  async preview(user: AuthUser | undefined, guestId: string | undefined, dto: CheckoutPreviewDto) {
    const cart = await this.cartService.getCartEntity(user, guestId);
    const lines = this.buildCheckoutLines(cart);

    if (lines.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const subtotal = this.sumLines(lines);
    const customerId = user ? await this.getCustomerId(user.id) : undefined;
    const country = await this.resolveCountry(user, dto.addressId, dto.country);

    const evaluation = dto.couponCode
      ? await this.couponsService.calculate(
          dto.couponCode,
          customerId,
          this.toPricedLines(lines),
          subtotal,
        )
      : null;

    const shipping = dto.shippingMethodId
      ? await this.shippingService.quote(dto.shippingMethodId, subtotal, country)
      : null;

    const discountTotal = evaluation?.discount ?? new Prisma.Decimal(0);
    const shippingTotal =
      evaluation?.freeShipping || !shipping ? new Prisma.Decimal(0) : shipping.price;
    const grandTotal = subtotal.minus(discountTotal).plus(shippingTotal);

    return {
      currency: cart.currency,
      itemCount: lines.length,
      totalQuantity: lines.reduce((total, line) => total + line.quantity, 0),
      subtotal: subtotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      shippingTotal: shippingTotal.toFixed(2),
      taxTotal: '0.00',
      grandTotal: grandTotal.toFixed(2),
      coupon: evaluation
        ? {
            code: evaluation.coupon.code,
            description: evaluation.coupon.description,
            type: evaluation.coupon.type,
            freeShipping: evaluation.freeShipping,
            discountAmount: evaluation.discount.toFixed(2),
          }
        : null,
      shipping: shipping
        ? {
            methodId: shipping.method.id,
            name: shipping.method.name,
            price: shipping.price.toFixed(2),
            isFree: shipping.isFree || Boolean(evaluation?.freeShipping),
            minDeliveryDays: shipping.minDeliveryDays,
            maxDeliveryDays: shipping.maxDeliveryDays,
          }
        : null,
      items: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        variantName: line.variantName,
        sku: line.sku,
        imageUrl: line.imageUrl,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal.toFixed(2),
      })),
    };
  }

  async createOrder(user: AuthUser | undefined, guestId: string | undefined, dto: CheckoutDto) {
    const cart = await this.cartService.getCartEntity(user, guestId);
    const lines = this.buildCheckoutLines(cart);

    if (lines.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const email = user?.email ?? dto.email;

    if (!email) {
      throw new BadRequestException('Email address is required for guest checkout');
    }

    if (!user && !dto.shippingAddress) {
      throw new BadRequestException('Shipping address is required for guest checkout');
    }

    const address = await this.resolveAddress(user, dto);
    const customerId = user ? await this.getCustomerId(user.id) : undefined;
    const subtotal = this.sumLines(lines);

    const evaluation = dto.couponCode
      ? await this.couponsService.calculate(
          dto.couponCode,
          customerId,
          this.toPricedLines(lines),
          subtotal,
        )
      : null;

    const shipping = await this.shippingService.quote(
      dto.shippingMethodId,
      subtotal,
      address.country,
    );

    const discountTotal = evaluation?.discount ?? new Prisma.Decimal(0);
    const shippingTotal = evaluation?.freeShipping ? new Prisma.Decimal(0) : shipping.price;
    const grandTotal = subtotal.minus(discountTotal).plus(shippingTotal);

    const orderNumber = this.generateOrderNumber();
    const reservationExpiry = new Date(Date.now() + 30 * 60 * 1000);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          email,
          phone: dto.phone ?? address.phone,
          status: OrderStatus.PENDING,
          currency: cart.currency,
          subtotal,
          discountTotal,
          shippingTotal,
          taxTotal: new Prisma.Decimal(0),
          grandTotal,
          couponCode: evaluation?.coupon.code,
          notes: dto.notes,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              variantName: line.variantName,
              sku: line.sku,
              imageUrl: line.imageUrl,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
            })),
          },
          addresses: {
            create: [
              {
                type: AddressType.SHIPPING,
                firstName: address.firstName,
                lastName: address.lastName,
                company: address.company,
                line1: address.line1,
                line2: address.line2,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country,
                phone: address.phone,
              },
            ],
          },
          statusHistory: {
            create: {
              toStatus: OrderStatus.PENDING,
              note: 'Order placed',
            },
          },
        },
        select: { id: true },
      });

      for (const line of lines) {
        const reserved = await tx.$queryRaw<{ id: string }[]>`
          UPDATE "Inventory"
          SET "reservedQuantity" = "reservedQuantity" + ${line.quantity}
          WHERE "variantId" = ${line.variantId}
            AND "trackInventory" = true
            AND ("quantity" - "reservedQuantity") >= ${line.quantity}
          RETURNING "id"
        `;

        if (reserved.length === 0) {
          throw new BadRequestException(
            `${line.productName} (${line.variantName}) no longer has enough stock`,
          );
        }

        await tx.stockReservation.create({
          data: {
            variantId: line.variantId,
            orderId: created.id,
            quantity: line.quantity,
            expiresAt: reservationExpiry,
          },
        });
      }

      if (evaluation) {
        await this.couponsService.recordUsage(tx, evaluation, created.id, customerId);
      }

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CONVERTED' },
      });

      return created;
    });

    const persisted = await this.ordersService.findEntity(order.id);

    void this.emailService.sendOrderConfirmationEmail(
      persisted.email,
      persisted.orderNumber,
      persisted.grandTotal.toFixed(2),
    );

    return this.ordersService.getResponse(persisted);
  }

  private buildCheckoutLines(cart: CartEntity): CheckoutLine[] {
    return cart.items.map((item) => {
      const variant = item.variant;
      const product = variant.product;

      if (!variant.isActive) {
        throw new BadRequestException(`${product.name} is no longer available`);
      }

      if (product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(`${product.name} is not available for purchase`);
      }

      if (variant.inventory?.trackInventory) {
        const available = Math.max(
          0,
          variant.inventory.quantity - variant.inventory.reservedQuantity,
        );

        if (item.quantity > available) {
          throw new BadRequestException(
            available === 0
              ? `${product.name} (${variant.name}) is out of stock`
              : `Only ${available} unit(s) of ${product.name} (${variant.name}) are available`,
          );
        }
      }

      const image =
        variant.images.find((image) => image.isPrimary) ??
        variant.images[0] ??
        product.images.find((image) => image.isPrimary) ??
        product.images[0] ??
        null;

      return {
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        variantName: variant.name,
        sku: variant.sku,
        imageUrl: image?.url ?? null,
        quantity: item.quantity,
        unitPrice: variant.price,
        lineTotal: variant.price.mul(item.quantity),
        categoryIds: product.categories.map((category) => category.categoryId),
        collectionIds: product.collections.map((collection) => collection.collectionId),
      };
    });
  }

  private toPricedLines(lines: CheckoutLine[]): PricedLine[] {
    return lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      categoryIds: line.categoryIds,
      collectionIds: line.collectionIds,
    }));
  }

  private sumLines(lines: CheckoutLine[]): Prisma.Decimal {
    return lines.reduce((total, line) => total.plus(line.lineTotal), new Prisma.Decimal(0));
  }

  private async getCustomerId(userId: string): Promise<string> {
    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, wishlist: { create: {} } },
      select: { id: true },
    });

    return profile.id;
  }

  private async resolveAddress(
    user: AuthUser | undefined,
    dto: CheckoutDto,
  ): Promise<{
    firstName: string;
    lastName: string;
    company?: string | null;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string | null;
  }> {
    if (dto.addressId) {
      if (!user) {
        throw new ForbiddenException('Sign in to use a saved address');
      }

      const customerId = await this.getCustomerId(user.id);
      const address = await this.prisma.customerAddress.findFirst({
        where: { id: dto.addressId, customerId },
      });

      if (!address) {
        throw new NotFoundException('Shipping address not found');
      }

      return address;
    }

    if (!dto.shippingAddress) {
      throw new BadRequestException('A shipping address is required');
    }

    return this.mapAddress(dto.shippingAddress);
  }

  private mapAddress(address: CreateAddressDto) {
    return {
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
    };
  }

  private async resolveCountry(
    user: AuthUser | undefined,
    addressId?: string,
    country?: string,
  ): Promise<string | undefined> {
    if (country) {
      return country;
    }

    if (!addressId || !user) {
      return undefined;
    }

    const customerId = await this.getCustomerId(user.id);
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
      select: { country: true },
    });

    return address?.country;
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
      date.getDate(),
    ).padStart(2, '0')}`;

    return `TB-${stamp}-${randomSuffix(6).toUpperCase()}`;
  }
}
