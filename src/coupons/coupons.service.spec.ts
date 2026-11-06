import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../database/prisma.service';
import { CouponsService, PricedLine } from './coupons.service';

interface CouponWithScopes extends Coupon {
  products: Array<{ couponId: string; productId: string }>;
  categories: Array<{ couponId: string; categoryId: string }>;
  collections: Array<{ couponId: string; collectionId: string }>;
}

type MockPrisma = {
  coupon: { findUnique: jest.Mock };
  couponUsage: { count: jest.Mock };
};

function makeCoupon(overrides: Partial<CouponWithScopes> = {}): CouponWithScopes {
  return {
    id: 'coupon-1',
    code: 'SAVE10',
    description: '10% off',
    type: DiscountType.PERCENTAGE,
    value: new Prisma.Decimal(10),
    minOrderAmount: null,
    maxDiscountAmount: null,
    startsAt: null,
    expiresAt: null,
    usageLimit: null,
    usageLimitPerCustomer: null,
    usedCount: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    products: [],
    categories: [],
    collections: [],
    ...overrides,
  };
}

function makeLine(overrides: Partial<PricedLine> = {}): PricedLine {
  const unitPrice = overrides.unitPrice ?? new Prisma.Decimal(50);
  const quantity = overrides.quantity ?? 1;

  return {
    productId: 'product-1',
    variantId: 'variant-1',
    quantity,
    unitPrice,
    lineTotal: unitPrice.mul(quantity),
    categoryIds: [],
    collectionIds: [],
    ...overrides,
  };
}

describe('CouponsService', () => {
  let prisma: MockPrisma;
  let service: CouponsService;

  beforeEach(() => {
    prisma = {
      coupon: { findUnique: jest.fn() },
      couponUsage: { count: jest.fn().mockResolvedValue(0) },
    };

    service = new CouponsService(prisma as unknown as PrismaService, {} as CartService);
  });

  it('applies a percentage discount to the eligible subtotal', async () => {
    prisma.coupon.findUnique.mockResolvedValue(makeCoupon());

    const result = await service.calculate(
      'save10',
      undefined,
      [makeLine({ quantity: 2 })],
      new Prisma.Decimal(100),
    );

    expect(result.discount.toFixed(2)).toBe('10.00');
    expect(result.eligibleSubtotal.toFixed(2)).toBe('100.00');
    expect(result.freeShipping).toBe(false);
  });

  it('caps a percentage discount at maxDiscountAmount', async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      makeCoupon({ maxDiscountAmount: new Prisma.Decimal(20) }),
    );

    const result = await service.calculate(
      'SAVE10',
      undefined,
      [makeLine({ unitPrice: new Prisma.Decimal(500) })],
      new Prisma.Decimal(500),
    );

    expect(result.discount.toFixed(2)).toBe('20.00');
  });

  it('never discounts more than the eligible subtotal for fixed amounts', async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      makeCoupon({
        type: DiscountType.FIXED_AMOUNT,
        value: new Prisma.Decimal(200),
      }),
    );

    const result = await service.calculate(
      'SAVE10',
      undefined,
      [makeLine({ unitPrice: new Prisma.Decimal(30) })],
      new Prisma.Decimal(30),
    );

    expect(result.discount.toFixed(2)).toBe('30.00');
  });

  it('flags free shipping without reducing the item subtotal', async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      makeCoupon({ type: DiscountType.FREE_SHIPPING, value: new Prisma.Decimal(0) }),
    );

    const result = await service.calculate(
      'SAVE10',
      undefined,
      [makeLine()],
      new Prisma.Decimal(50),
    );

    expect(result.freeShipping).toBe(true);
    expect(result.discount.toFixed(2)).toBe('0.00');
  });

  it('only discounts lines matching the configured scopes', async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      makeCoupon({
        products: [{ couponId: 'coupon-1', productId: 'product-2' }],
      }),
    );

    const result = await service.calculate(
      'SAVE10',
      undefined,
      [
        makeLine({ productId: 'product-1', unitPrice: new Prisma.Decimal(100) }),
        makeLine({
          productId: 'product-2',
          variantId: 'variant-2',
          unitPrice: new Prisma.Decimal(50),
        }),
      ],
      new Prisma.Decimal(150),
    );

    expect(result.eligibleSubtotal.toFixed(2)).toBe('50.00');
    expect(result.discount.toFixed(2)).toBe('5.00');
  });

  it('rejects orders below the coupon minimum', async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      makeCoupon({ minOrderAmount: new Prisma.Decimal(50) }),
    );

    await expect(
      service.calculate('SAVE10', undefined, [makeLine()], new Prisma.Decimal(49)),
    ).rejects.toThrow('minimum order');
  });

  it('rejects expired coupons', async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      makeCoupon({ expiresAt: new Date(Date.now() - 60_000) }),
    );

    await expect(
      service.calculate('SAVE10', undefined, [makeLine()], new Prisma.Decimal(50)),
    ).rejects.toThrow('expired');
  });

  it('enforces per-customer usage limits', async () => {
    prisma.coupon.findUnique.mockResolvedValue(makeCoupon({ usageLimitPerCustomer: 1 }));
    prisma.couponUsage.count.mockResolvedValue(1);

    await expect(
      service.calculate('SAVE10', 'customer-1', [makeLine()], new Prisma.Decimal(50)),
    ).rejects.toThrow('already used');
  });

  it('enforces global usage limits', async () => {
    prisma.coupon.findUnique.mockResolvedValue(makeCoupon({ usageLimit: 5, usedCount: 5 }));

    await expect(
      service.calculate('SAVE10', undefined, [makeLine()], new Prisma.Decimal(50)),
    ).rejects.toThrow('usage limit');
  });

  it('treats missing or inactive coupons as invalid', async () => {
    prisma.coupon.findUnique.mockResolvedValue(null);

    await expect(
      service.calculate('NOPE', undefined, [makeLine()], new Prisma.Decimal(50)),
    ).rejects.toThrow('Invalid or expired coupon');

    prisma.coupon.findUnique.mockResolvedValue(makeCoupon({ isActive: false }));

    await expect(
      service.calculate('SAVE10', undefined, [makeLine()], new Prisma.Decimal(50)),
    ).rejects.toThrow('Invalid or expired coupon');
  });
});
