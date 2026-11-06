import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CartEntity, CartService } from '../cart/cart.service';
import { buildPaginationMeta, getSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../database/prisma.service';
import { AdminCouponQueryDto, CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

export interface PricedLine {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  categoryIds: string[];
  collectionIds: string[];
}

export interface CouponEvaluation {
  coupon: Coupon;
  eligibleSubtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  freeShipping: boolean;
}

const couponInclude = {
  products: true,
  categories: true,
  collections: true,
} satisfies Prisma.CouponInclude;

type CouponPayload = Prisma.CouponGetPayload<{ include: typeof couponInclude }>;

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  buildLines(cart: CartEntity): PricedLine[] {
    return cart.items.map((item) => {
      const variant = item.variant;
      const lineTotal = variant.price.mul(item.quantity);

      return {
        productId: variant.productId,
        variantId: variant.id,
        quantity: item.quantity,
        unitPrice: variant.price,
        lineTotal,
        categoryIds: variant.product.categories.map((category) => category.categoryId),
        collectionIds: variant.product.collections.map((collection) => collection.collectionId),
      };
    });
  }

  async validateForCart(user?: AuthUser, guestId?: string, code?: string) {
    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }

    const cart = await this.cartService.getCartEntity(user, guestId);

    if (cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const lines = this.buildLines(cart);
    const subtotal = lines.reduce(
      (total, line) => total.plus(line.lineTotal),
      new Prisma.Decimal(0),
    );
    const evaluation = await this.calculate(code, cart.customerId ?? undefined, lines, subtotal);

    return {
      code: evaluation.coupon.code,
      description: evaluation.coupon.description,
      type: evaluation.coupon.type,
      value: evaluation.coupon.value,
      freeShipping: evaluation.freeShipping,
      eligibleSubtotal: evaluation.eligibleSubtotal.toFixed(2),
      discountAmount: evaluation.discount.toFixed(2),
      cartSubtotal: subtotal.toFixed(2),
      totalAfterDiscount: subtotal.minus(evaluation.discount).toFixed(2),
    };
  }

  async calculate(
    code: string,
    customerId: string | undefined,
    lines: PricedLine[],
    subtotal: Prisma.Decimal,
  ): Promise<CouponEvaluation> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: couponInclude,
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid or expired coupon');
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }

    if (customerId && coupon.usageLimitPerCustomer !== null) {
      const customerUsages = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, customerId },
      });

      if (customerUsages >= coupon.usageLimitPerCustomer) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    if (coupon.minOrderAmount !== null && subtotal.lessThan(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `This coupon requires a minimum order of ${coupon.minOrderAmount.toFixed(2)}`,
      );
    }

    const hasScopes =
      coupon.products.length > 0 || coupon.categories.length > 0 || coupon.collections.length > 0;

    const productIds = new Set(coupon.products.map((item) => item.productId));
    const categoryIds = new Set(coupon.categories.map((item) => item.categoryId));
    const collectionIds = new Set(coupon.collections.map((item) => item.collectionId));

    const eligibleLines = hasScopes
      ? lines.filter(
          (line) =>
            productIds.has(line.productId) ||
            line.categoryIds.some((id) => categoryIds.has(id)) ||
            line.collectionIds.some((id) => collectionIds.has(id)),
        )
      : lines;

    const eligibleSubtotal = eligibleLines.reduce(
      (total, line) => total.plus(line.lineTotal),
      new Prisma.Decimal(0),
    );

    if (hasScopes && eligibleSubtotal.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Coupon is not applicable to the items in your cart');
    }

    let discount = new Prisma.Decimal(0);
    let freeShipping = false;

    switch (coupon.type) {
      case DiscountType.PERCENTAGE:
        discount = eligibleSubtotal.mul(coupon.value).div(100);
        if (coupon.maxDiscountAmount !== null) {
          discount = Prisma.Decimal.min(discount, coupon.maxDiscountAmount);
        }
        break;
      case DiscountType.FIXED_AMOUNT:
        discount = Prisma.Decimal.min(coupon.value, eligibleSubtotal);
        break;
      case DiscountType.FREE_SHIPPING:
        freeShipping = true;
        break;
    }

    discount = discount.toDecimalPlaces(2);
    if (discount.lessThan(0)) {
      discount = new Prisma.Decimal(0);
    }

    return {
      coupon,
      eligibleSubtotal,
      discount,
      freeShipping,
    };
  }

  async recordUsage(
    tx: Prisma.TransactionClient,
    evaluation: CouponEvaluation,
    orderId: string,
    customerId: string | undefined,
  ): Promise<void> {
    await tx.coupon.update({
      where: { id: evaluation.coupon.id },
      data: { usedCount: { increment: 1 } },
    });

    await tx.couponUsage.create({
      data: {
        couponId: evaluation.coupon.id,
        customerId,
        orderId,
      },
    });

    await tx.discount.create({
      data: {
        orderId,
        couponId: evaluation.coupon.id,
        code: evaluation.coupon.code,
        description: evaluation.coupon.description,
        type: evaluation.coupon.type,
        value: evaluation.coupon.value,
        amount: evaluation.discount,
      },
    });
  }

  async findAllAdmin(query: AdminCouponQueryDto) {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const where: Prisma.CouponWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, coupons] = await this.prisma.$transaction([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        include: { _count: { select: { usages: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      items: coupons,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findAdminById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: couponInclude,
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.toResponse(coupon);
  }

  async create(dto: CreateCouponDto) {
    this.assertValidMoney(dto);

    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        description: dto.description,
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxDiscountAmount: dto.maxDiscountAmount,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        usageLimit: dto.usageLimit,
        usageLimitPerCustomer: dto.usageLimitPerCustomer,
        isActive: dto.isActive ?? true,
        products: dto.productIds?.length
          ? {
              create: dto.productIds.map((productId) => ({
                product: { connect: { id: productId } },
              })),
            }
          : undefined,
        categories: dto.categoryIds?.length
          ? {
              create: dto.categoryIds.map((categoryId) => ({
                category: { connect: { id: categoryId } },
              })),
            }
          : undefined,
        collections: dto.collectionIds?.length
          ? {
              create: dto.collectionIds.map((collectionId) => ({
                collection: { connect: { id: collectionId } },
              })),
            }
          : undefined,
      },
      include: couponInclude,
    });

    return this.toResponse(coupon);
  }

  async update(id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
      select: { id: true, startsAt: true, expiresAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    this.assertValidMoney(dto);

    const startsAt =
      dto.startsAt !== undefined
        ? dto.startsAt
          ? new Date(dto.startsAt)
          : null
        : existing.startsAt;
    const expiresAt =
      dto.expiresAt !== undefined
        ? dto.expiresAt
          ? new Date(dto.expiresAt)
          : null
        : existing.expiresAt;

    if (startsAt && expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException('Expiration date must be after the start date');
    }

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount } : {}),
        ...(dto.maxDiscountAmount !== undefined
          ? { maxDiscountAmount: dto.maxDiscountAmount }
          : {}),
        ...(dto.startsAt !== undefined ? { startsAt } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt } : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        ...(dto.usageLimitPerCustomer !== undefined
          ? { usageLimitPerCustomer: dto.usageLimitPerCustomer }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.productIds !== undefined
          ? {
              products: {
                deleteMany: {},
                create: dto.productIds.map((productId) => ({
                  product: { connect: { id: productId } },
                })),
              },
            }
          : {}),
        ...(dto.categoryIds !== undefined
          ? {
              categories: {
                deleteMany: {},
                create: dto.categoryIds.map((categoryId) => ({
                  category: { connect: { id: categoryId } },
                })),
              },
            }
          : {}),
        ...(dto.collectionIds !== undefined
          ? {
              collections: {
                deleteMany: {},
                create: dto.collectionIds.map((collectionId) => ({
                  collection: { connect: { id: collectionId } },
                })),
              },
            }
          : {}),
      },
      include: couponInclude,
    });

    return this.toResponse(coupon);
  }

  async remove(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    await this.prisma.coupon.delete({ where: { id } });
    return { id, deleted: true };
  }

  private assertValidMoney(dto: CreateCouponDto | UpdateCouponDto): void {
    if (dto.type === DiscountType.PERCENTAGE && dto.value !== undefined && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    if (dto.startsAt && dto.expiresAt && new Date(dto.expiresAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('Expiration date must be after the start date');
    }
  }

  private toResponse(coupon: CouponPayload) {
    return {
      ...coupon,
      productIds: coupon.products.map((item) => item.productId),
      categoryIds: coupon.categories.map((item) => item.categoryId),
      collectionIds: coupon.collections.map((item) => item.collectionId),
      products: undefined,
      categories: undefined,
      collections: undefined,
    };
  }
}
