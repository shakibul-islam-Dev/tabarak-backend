import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { buildPaginationMeta, getSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminCustomerQueryDto } from './dto/admin-customer.dto';

const customerListSelect = {
  id: true,
  phone: true,
  status: true,
  marketingOptIn: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
    },
  },
  _count: {
    select: { orders: true, addresses: true },
  },
} satisfies Prisma.CustomerProfileSelect;

@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: AdminCustomerQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = getSkipTake(page, limit);

    const where: Prisma.CustomerProfileWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.marketingOptIn !== undefined ? { marketingOptIn: query.marketingOptIn } : {}),
      ...(query.search
        ? {
            user: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.customerProfile.count({ where }),
      this.prisma.customerProfile.findMany({
        where,
        select: customerListSelect,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            image: true,
            createdAt: true,
          },
        },
        addresses: { orderBy: { createdAt: 'desc' } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            grandTotal: true,
            currency: true,
            createdAt: true,
          },
        },
        _count: { select: { orders: true, addresses: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateStatus(id: string, status: CustomerStatus, actorUserId?: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.customerProfile.update({
      where: { id },
      data: { status },
      select: customerListSelect,
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'customer.status.updated',
      entityType: 'CustomerProfile',
      entityId: id,
      metadata: { from: customer.status, to: status, userId: customer.userId },
    });

    return updated;
  }
}
