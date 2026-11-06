import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CreateShippingMethodDto,
  CreateShippingZoneDto,
  UpdateShippingMethodDto,
  UpdateShippingZoneDto,
} from './dto/shipping.dto';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async findMethods(country?: string) {
    const normalizedCountry = country?.trim().toUpperCase();
    const where: Prisma.ShippingMethodWhereInput = {
      isActive: true,
      zone: {
        isActive: true,
        ...(normalizedCountry
          ? {
              OR: [{ countries: { isEmpty: true } }, { countries: { has: normalizedCountry } }],
            }
          : {}),
      },
    };

    return this.prisma.shippingMethod.findMany({
      where,
      include: { zone: true },
      orderBy: { price: 'asc' },
    });
  }

  async quote(methodId: string, subtotal: Prisma.Decimal, country?: string) {
    const method = await this.prisma.shippingMethod.findUnique({
      where: { id: methodId },
      include: { zone: true },
    });

    if (!method || !method.isActive || !method.zone.isActive) {
      throw new NotFoundException('Shipping method not found');
    }

    if (country && method.zone.countries.length > 0) {
      const normalized = country.trim().toUpperCase();
      if (!method.zone.countries.map((item) => item.toUpperCase()).includes(normalized)) {
        throw new BadRequestException('Shipping method is not available for this country');
      }
    }

    const isFree =
      method.freeShippingThreshold !== null &&
      subtotal.greaterThanOrEqualTo(method.freeShippingThreshold);
    const price = isFree ? new Prisma.Decimal(0) : method.price;

    return {
      method,
      price,
      isFree,
      minDeliveryDays: method.minDeliveryDays,
      maxDeliveryDays: method.maxDeliveryDays,
    };
  }

  async findZones() {
    return this.prisma.shippingZone.findMany({
      include: { _count: { select: { methods: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createZone(dto: CreateShippingZoneDto) {
    return this.prisma.shippingZone.create({
      data: {
        name: dto.name,
        countries: (dto.countries ?? []).map((country) => country.toUpperCase()),
        regions: dto.regions ?? [],
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateZone(id: string, dto: UpdateShippingZoneDto) {
    await this.assertZone(id);

    return this.prisma.shippingZone.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.countries !== undefined
          ? { countries: dto.countries.map((country) => country.toUpperCase()) }
          : {}),
        ...(dto.regions !== undefined ? { regions: dto.regions } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async removeZone(id: string) {
    await this.assertZone(id);
    await this.prisma.shippingZone.delete({ where: { id } });
    return { id, deleted: true };
  }

  async findAdminMethods() {
    return this.prisma.shippingMethod.findMany({
      include: { zone: true },
      orderBy: [{ zone: { name: 'asc' } }, { price: 'asc' }],
    });
  }

  async createMethod(dto: CreateShippingMethodDto) {
    await this.assertZone(dto.zoneId);

    if (
      dto.maxDeliveryDays !== undefined &&
      dto.minDeliveryDays !== undefined &&
      dto.maxDeliveryDays < dto.minDeliveryDays
    ) {
      throw new BadRequestException('Maximum delivery days cannot be less than minimum');
    }

    return this.prisma.shippingMethod.create({
      data: {
        zoneId: dto.zoneId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        freeShippingThreshold: dto.freeShippingThreshold,
        minDeliveryDays: dto.minDeliveryDays ?? 1,
        maxDeliveryDays: dto.maxDeliveryDays ?? 7,
        isActive: dto.isActive ?? true,
      },
      include: { zone: true },
    });
  }

  async updateMethod(id: string, dto: UpdateShippingMethodDto) {
    const method = await this.prisma.shippingMethod.findUnique({
      where: { id },
      select: { id: true, minDeliveryDays: true, maxDeliveryDays: true },
    });

    if (!method) {
      throw new NotFoundException('Shipping method not found');
    }

    if (dto.zoneId !== undefined) {
      await this.assertZone(dto.zoneId);
    }

    const minDays = dto.minDeliveryDays ?? method.minDeliveryDays;
    const maxDays = dto.maxDeliveryDays ?? method.maxDeliveryDays;

    if (maxDays < minDays) {
      throw new BadRequestException('Maximum delivery days cannot be less than minimum');
    }

    return this.prisma.shippingMethod.update({
      where: { id },
      data: {
        ...(dto.zoneId !== undefined ? { zoneId: dto.zoneId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.freeShippingThreshold !== undefined
          ? { freeShippingThreshold: dto.freeShippingThreshold }
          : {}),
        ...(dto.minDeliveryDays !== undefined ? { minDeliveryDays: dto.minDeliveryDays } : {}),
        ...(dto.maxDeliveryDays !== undefined ? { maxDeliveryDays: dto.maxDeliveryDays } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { zone: true },
    });
  }

  async removeMethod(id: string) {
    const method = await this.prisma.shippingMethod.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!method) {
      throw new NotFoundException('Shipping method not found');
    }

    await this.prisma.shippingMethod.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertZone(id: string): Promise<void> {
    const zone = await this.prisma.shippingZone.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!zone) {
      throw new NotFoundException('Shipping zone not found');
    }
  }
}
