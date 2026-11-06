import { Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: AuthUser) {
    await this.prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, wishlist: { create: {} } },
    });

    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        customer: {
          include: {
            addresses: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
  }

  async updateMe(user: AuthUser, dto: UpdateCustomerDto) {
    await this.prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, wishlist: { create: {} } },
    });

    if (dto.name !== undefined) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { name: dto.name },
      });
    }

    await this.prisma.customerProfile.update({
      where: { userId: user.id },
      data: {
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        ...(dto.marketingOptIn !== undefined ? { marketingOptIn: dto.marketingOptIn } : {}),
      },
    });

    return this.getMe(user);
  }
}
