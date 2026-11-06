import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser) {
    const customerId = await this.getCustomerId(user.id);

    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(user: AuthUser, dto: CreateAddressDto) {
    const customerId = await this.getCustomerId(user.id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultShipping) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }

      if (dto.isDefaultBilling) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }

      return tx.customerAddress.create({
        data: { ...this.toData(dto), customerId },
      });
    });
  }

  async update(user: AuthUser, addressId: string, dto: UpdateAddressDto) {
    const customerId = await this.getCustomerId(user.id);
    await this.assertOwned(customerId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultShipping) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefaultShipping: true, NOT: { id: addressId } },
          data: { isDefaultShipping: false },
        });
      }

      if (dto.isDefaultBilling) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefaultBilling: true, NOT: { id: addressId } },
          data: { isDefaultBilling: false },
        });
      }

      return tx.customerAddress.update({
        where: { id: addressId },
        data: this.toData(dto),
      });
    });
  }

  async remove(user: AuthUser, addressId: string) {
    const customerId = await this.getCustomerId(user.id);
    await this.assertOwned(customerId, addressId);
    await this.prisma.customerAddress.delete({ where: { id: addressId } });

    return { id: addressId, deleted: true };
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

  private async assertOwned(customerId: string, addressId: string): Promise<void> {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
      select: { id: true },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }
  }

  private toData(
    dto: CreateAddressDto | UpdateAddressDto,
  ): Prisma.CustomerAddressUncheckedCreateInput {
    return {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.company !== undefined ? { company: dto.company } : {}),
      ...(dto.line1 !== undefined ? { line1: dto.line1 } : {}),
      ...(dto.line2 !== undefined ? { line2: dto.line2 } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.state !== undefined ? { state: dto.state } : {}),
      ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
      ...(dto.country !== undefined ? { country: dto.country } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.isDefaultShipping !== undefined ? { isDefaultShipping: dto.isDefaultShipping } : {}),
      ...(dto.isDefaultBilling !== undefined ? { isDefaultBilling: dto.isDefaultBilling } : {}),
    } as Prisma.CustomerAddressUncheckedCreateInput;
  }
}
