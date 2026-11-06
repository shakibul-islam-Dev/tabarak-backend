import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma, ReservationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { buildPaginationMeta, getSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../database/prisma.service';
import { InventoryQueryDto, UpdateStockDto } from './dto/inventory.dto';

const inventoryInclude = {
  variant: {
    include: {
      product: { select: { id: true, name: true, slug: true, status: true } },
      images: { take: 1, orderBy: { sortOrder: 'asc' as const } },
    },
  },
} satisfies Prisma.InventoryInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: InventoryQueryDto) {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const where: Prisma.InventoryWhereInput = {};

    if (query.q) {
      where.variant = {
        OR: [
          { sku: { contains: query.q, mode: 'insensitive' } },
          { name: { contains: query.q, mode: 'insensitive' } },
          { product: { name: { contains: query.q, mode: 'insensitive' } } },
        ],
      };
    }

    if (query.lowStock) {
      where.trackInventory = true;
      where.quantity = { lte: this.prisma.inventory.fields.lowStockThreshold };
    }

    const [total, inventory] = await this.prisma.$transaction([
      this.prisma.inventory.count({ where }),
      this.prisma.inventory.findMany({
        where,
        include: inventoryInclude,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      items: inventory.map((item) => this.toResponse(item)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getByVariantId(variantId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { variantId },
      include: inventoryInclude,
    });

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    return this.toResponse(inventory);
  }

  async getAvailableStock(variantId: string): Promise<number | null> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { variantId },
      select: { quantity: true, reservedQuantity: true, trackInventory: true },
    });

    if (!inventory) {
      return null;
    }

    if (!inventory.trackInventory) {
      return null;
    }

    return Math.max(0, inventory.quantity - inventory.reservedQuantity);
  }

  async updateStock(variantId: string, dto: UpdateStockDto, userId?: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventory.upsert({
        where: { variantId },
        update: {},
        create: { variantId, quantity: 0 },
      });

      const newQuantity = dto.quantity;
      const previous = existing.quantity;

      if (newQuantity < existing.reservedQuantity) {
        throw new BadRequestException('Stock quantity cannot be lower than the reserved quantity');
      }

      const inventory = await tx.inventory.update({
        where: { variantId },
        data: {
          quantity: newQuantity,
          ...(dto.lowStockThreshold !== undefined
            ? { lowStockThreshold: dto.lowStockThreshold }
            : {}),
          ...(dto.trackInventory !== undefined ? { trackInventory: dto.trackInventory } : {}),
        },
      });

      if (previous !== newQuantity) {
        await tx.inventoryMovement.create({
          data: {
            variantId,
            type: InventoryMovementType.ADJUSTMENT,
            quantity: newQuantity - previous,
            previousQuantity: previous,
            newQuantity,
            reason: dto.reason ?? 'Manual stock adjustment',
            createdByUserId: userId,
          },
        });
      }

      return inventory;
    });

    await this.audit.log({
      userId,
      action: 'inventory.adjusted',
      entityType: 'Inventory',
      entityId: updated.id,
      metadata: {
        variantId,
        quantity: dto.quantity,
        lowStockThreshold: dto.lowStockThreshold,
        trackInventory: dto.trackInventory,
        reason: dto.reason ?? 'Manual stock adjustment',
      },
    });

    return updated;
  }

  async listMovements(variantId: string | undefined, page: number, limit: number) {
    const { skip, take } = getSkipTake(page, limit);
    const where: Prisma.InventoryMovementWhereInput = variantId ? { variantId } : {};

    const [total, movements] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          variant: { select: { id: true, name: true, sku: true } },
          createdByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      items: movements,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Reserves stock for a cart or order. Uses an atomic conditional update so
   * concurrent checkouts cannot oversell the same variant.
   */
  async reserve(
    variantId: string,
    quantity: number,
    options: { cartId?: string; orderId?: string; ttlMinutes?: number } = {},
  ) {
    const ttlMinutes = options.ttlMinutes ?? 15;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "Inventory"
        SET "reservedQuantity" = "reservedQuantity" + ${quantity}
        WHERE "variantId" = ${variantId}
          AND "trackInventory" = true
          AND ("quantity" - "reservedQuantity") >= ${quantity}
        RETURNING "id"
      `;

      if (updated.length === 0) {
        throw new BadRequestException('Insufficient stock for this variant');
      }

      return tx.stockReservation.create({
        data: {
          variantId,
          quantity,
          cartId: options.cartId,
          orderId: options.orderId,
          status: ReservationStatus.ACTIVE,
          expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        },
      });
    });
  }

  async releaseReservation(reservationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
        return null;
      }

      await tx.inventory.update({
        where: { variantId: reservation.variantId },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });

      return tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.RELEASED },
      });
    });
  }

  /**
   * Releases cart stock reservations that have passed their expiry time.
   *
   * Order reservations are deliberately excluded: they are governed by the
   * order lifecycle (see OrdersService) and must be released or consumed with
   * their order so order history remains accurate.
   *
   * The whole cleanup runs as one statement so concurrent callers cannot
   * release the same reservation twice (`FOR UPDATE SKIP LOCKED`).
   */
  async releaseExpiredReservations(limit = 100, userId?: string) {
    const released = await this.prisma.$queryRaw<
      { id: string; variantId: string; quantity: number }[]
    >`
      WITH expired AS (
        UPDATE "StockReservation"
        SET "status" = 'EXPIRED', "updatedAt" = NOW()
        WHERE "id" IN (
          SELECT "id"
          FROM "StockReservation"
          WHERE "status" = 'ACTIVE'
            AND "expiresAt" <= NOW()
            AND "cartId" IS NOT NULL
            AND "orderId" IS NULL
          ORDER BY "expiresAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "variantId", "quantity"
      ),
      totals AS (
        SELECT "variantId", SUM("quantity")::int AS "quantity"
        FROM expired
        GROUP BY "variantId"
      ),
      restocked AS (
        UPDATE "Inventory" AS inventory
        SET "reservedQuantity" = GREATEST(0, inventory."reservedQuantity" - totals."quantity")
        FROM totals
        WHERE inventory."variantId" = totals."variantId"
        RETURNING inventory."variantId"
      )
      SELECT "id", "variantId", "quantity" FROM expired
    `;

    if (released.length > 0) {
      await this.audit.log({
        userId,
        action: 'inventory.reservations.expired',
        entityType: 'StockReservation',
        metadata: {
          releasedCount: released.length,
          reservations: released.map((reservation) => ({
            id: reservation.id,
            variantId: reservation.variantId,
            quantity: reservation.quantity,
          })),
        },
      });
    }

    return {
      released: released.length,
      reservations: released,
    };
  }

  private toResponse(inventory: Prisma.InventoryGetPayload<{ include: typeof inventoryInclude }>) {
    return {
      id: inventory.id,
      variantId: inventory.variantId,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      availableQuantity: Math.max(0, inventory.quantity - inventory.reservedQuantity),
      lowStockThreshold: inventory.lowStockThreshold,
      trackInventory: inventory.trackInventory,
      isLowStock:
        inventory.trackInventory &&
        inventory.quantity - inventory.reservedQuantity <= inventory.lowStockThreshold,
      isOutOfStock:
        inventory.trackInventory && inventory.quantity - inventory.reservedQuantity <= 0,
      updatedAt: inventory.updatedAt,
      variant: inventory.variant,
    };
  }
}
