import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalProducts,
      activeProducts,
      draftProducts,
      totalOrders,
      pendingOrders,
      totalCustomers,
      lowStockItems,
      revenue,
      recentOrders,
    ] = await this.prisma.$transaction([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { status: 'DRAFT' } }),
      this.prisma.order.count(),
      this.prisma.order.count({
        where: {
          status: {
            in: [
              OrderStatus.PENDING,
              OrderStatus.AWAITING_PAYMENT,
              OrderStatus.PROCESSING,
              OrderStatus.PACKED,
            ],
          },
        },
      }),
      this.prisma.customerProfile.count(),
      this.prisma.inventory.count({
        where: {
          trackInventory: true,
          quantity: { lte: this.prisma.inventory.fields.lowStockThreshold },
        },
      }),
      this.prisma.order.aggregate({
        where: { status: { not: OrderStatus.CANCELLED } },
        _sum: { grandTotal: true },
      }),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          email: true,
          status: true,
          grandTotal: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      products: {
        total: totalProducts,
        active: activeProducts,
        draft: draftProducts,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
      },
      customers: {
        total: totalCustomers,
      },
      inventory: {
        lowStock: lowStockItems,
      },
      revenue: {
        gross: revenue._sum.grandTotal ?? 0,
        currency: 'USD',
      },
      recentOrders,
    };
  }
}
