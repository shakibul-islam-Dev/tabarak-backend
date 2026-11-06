import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  OrderStatus,
  Prisma,
  ReservationStatus,
  ShipmentStatus,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { buildPaginationMeta, getSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import {
  CancelOrderDto,
  CreateShipmentDto,
  OrderQueryDto,
  UpdateShipmentDto,
} from './dto/order.dto';

const orderInclude = {
  items: true,
  addresses: true,
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  discounts: true,
  shipments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

type OrderPayload = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.AWAITING_PAYMENT, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  AWAITING_PAYMENT: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

export const STOCK_CONSUMING_STATUSES = new Set<OrderStatus>([
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
]);

export const CUSTOMER_CANCELLABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.AWAITING_PAYMENT,
]);

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly audit: AuditService,
  ) {}

  async findForCustomer(user: AuthUser, query: OrderQueryDto) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!profile) {
      return {
        items: [],
        meta: buildPaginationMeta(query.page, query.limit, 0),
      };
    }

    const { skip, take } = getSkipTake(query.page, query.limit);
    const where: Prisma.OrderWhereInput = {
      customerId: profile.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      items: orders.map((order) => this.toResponse(order)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOneForCustomer(user: AuthUser, orderId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: profile?.id ?? '__none__' },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.toResponse(order);
  }

  async cancelForCustomer(user: AuthUser, orderId: string, dto: CancelOrderDto) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: profile?.id ?? '__none__' },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!CUSTOMER_CANCELLABLE_STATUSES.has(order.status)) {
      throw new ForbiddenException('This order can no longer be cancelled online');
    }

    return this.updateStatus(
      orderId,
      OrderStatus.CANCELLED,
      user.id,
      dto.reason ?? 'Cancelled by customer',
    );
  }

  async findForAdmin(query: OrderQueryDto) {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { orderNumber: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      items: orders.map((order) => this.toResponse(order)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOneForAdmin(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        ...orderInclude,
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.toResponse(order);
  }

  async findEntity(orderId: string): Promise<OrderPayload> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(
    orderId: string,
    nextStatus: OrderStatus,
    changedByUserId?: string,
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { reservations: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === nextStatus) {
      return this.findEntity(orderId);
    }

    if (!canTransitionOrder(order.status, nextStatus)) {
      throw new BadRequestException(
        `Cannot change order status from ${order.status} to ${nextStatus}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (nextStatus === OrderStatus.CANCELLED) {
        await this.releaseOrRestoreStock(tx, order.id, order.reservations);
      } else if (STOCK_CONSUMING_STATUSES.has(nextStatus)) {
        await this.consumeStock(tx, order.id, order.reservations);
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          ...(nextStatus === OrderStatus.CANCELLED ? { cancelledAt: new Date() } : {}),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: nextStatus,
          note,
          changedByUserId,
        },
      });
    });

    await this.audit.log({
      userId: changedByUserId,
      action: 'order.status.updated',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        fromStatus: order.status,
        toStatus: nextStatus,
        note,
      },
    });

    void this.emailService.sendOrderStatusEmail(order.email, order.orderNumber, nextStatus);

    return this.findEntity(orderId);
  }

  async createShipment(orderId: string, dto: CreateShipmentDto) {
    await this.findEntity(orderId);

    const now = new Date();

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        shipments: {
          create: {
            carrier: dto.carrier,
            trackingNumber: dto.trackingNumber,
            status: dto.status ?? ShipmentStatus.PREPARING,
            ...(dto.status === ShipmentStatus.SHIPPED ? { shippedAt: now } : {}),
            ...(dto.status === ShipmentStatus.DELIVERED ? { deliveredAt: now } : {}),
          },
        },
      },
      include: { shipments: true },
    });
  }

  async updateShipment(orderId: string, shipmentId: string, dto: UpdateShipmentDto) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, orderId },
      select: { id: true },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const now = new Date();

    return this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
        ...(dto.trackingNumber !== undefined ? { trackingNumber: dto.trackingNumber } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.status === ShipmentStatus.SHIPPED ? { shippedAt: now } : {}),
        ...(dto.status === ShipmentStatus.DELIVERED ? { deliveredAt: now } : {}),
      },
    });
  }

  getResponse(order: OrderPayload) {
    return this.toResponse(order);
  }

  private async consumeStock(
    tx: Prisma.TransactionClient,
    orderId: string,
    reservations: { id: string; variantId: string; quantity: number; status: ReservationStatus }[],
  ): Promise<void> {
    const activeReservations = reservations.filter(
      (reservation) => reservation.status === ReservationStatus.ACTIVE,
    );

    for (const reservation of activeReservations) {
      const updated = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "Inventory"
        SET "quantity" = "quantity" - ${reservation.quantity},
            "reservedQuantity" = "reservedQuantity" - ${reservation.quantity}
        WHERE "variantId" = ${reservation.variantId}
          AND "reservedQuantity" >= ${reservation.quantity}
          AND "quantity" >= ${reservation.quantity}
        RETURNING "id"
      `;

      if (updated.length === 0) {
        throw new BadRequestException('Unable to fulfill reserved stock for this order');
      }

      const inventory = await tx.inventory.findUnique({
        where: { variantId: reservation.variantId },
        select: { quantity: true },
      });

      await tx.inventoryMovement.create({
        data: {
          variantId: reservation.variantId,
          type: InventoryMovementType.SALE,
          quantity: -reservation.quantity,
          previousQuantity: (inventory?.quantity ?? 0) + reservation.quantity,
          newQuantity: inventory?.quantity ?? 0,
          reason: `Order ${orderId} fulfilled`,
          referenceId: orderId,
        },
      });

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CONSUMED },
      });
    }
  }

  private async releaseOrRestoreStock(
    tx: Prisma.TransactionClient,
    orderId: string,
    reservations: { id: string; variantId: string; quantity: number; status: ReservationStatus }[],
  ): Promise<void> {
    for (const reservation of reservations) {
      if (reservation.status === ReservationStatus.ACTIVE) {
        const updated = await tx.$queryRaw<{ id: string }[]>`
          UPDATE "Inventory"
          SET "reservedQuantity" = "reservedQuantity" - ${reservation.quantity}
          WHERE "variantId" = ${reservation.variantId}
            AND "reservedQuantity" >= ${reservation.quantity}
          RETURNING "id"
        `;

        if (updated.length > 0) {
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { status: ReservationStatus.RELEASED },
          });
        }
      } else if (reservation.status === ReservationStatus.CONSUMED) {
        const inventory = await tx.inventory.update({
          where: { variantId: reservation.variantId },
          data: { quantity: { increment: reservation.quantity } },
          select: { quantity: true },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: reservation.variantId,
            type: InventoryMovementType.RETURN,
            quantity: reservation.quantity,
            previousQuantity: inventory.quantity - reservation.quantity,
            newQuantity: inventory.quantity,
            reason: `Order ${orderId} cancelled`,
            referenceId: orderId,
          },
        });
      }
    }
  }

  private toResponse(order: OrderPayload & { customer?: unknown }) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      email: order.email,
      phone: order.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      shippingTotal: order.shippingTotal,
      taxTotal: order.taxTotal,
      grandTotal: order.grandTotal,
      couponCode: order.couponCode,
      notes: order.notes,
      placedAt: order.placedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items,
      addresses: order.addresses,
      statusHistory: order.statusHistory,
      discounts: order.discounts,
      shipments: order.shipments,
      ...(order.customer ? { customer: order.customer } : {}),
    };
  }
}
