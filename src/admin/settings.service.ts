import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Only these keys are exposed on the public storefront settings endpoint.
 * Everything else stays behind the admin API.
 */
export const PUBLIC_SETTING_KEYS = [
  'site.name',
  'site.tagline',
  'site.description',
  'site.logoUrl',
  'site.faviconUrl',
  'site.currency',
  'site.contactEmail',
  'site.contactPhone',
  'site.address',
  'site.social',
  'shipping.freeShippingThreshold',
  'shipping.defaultCountry',
  'seo.defaultTitle',
  'seo.defaultDescription',
] as const;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPublicSettings() {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { in: [...PUBLIC_SETTING_KEYS] } },
      orderBy: { key: 'asc' },
    });

    return rows.reduce<Record<string, unknown>>((settings, row) => {
      if (!FORBIDDEN_KEYS.has(row.key)) {
        settings[row.key] = row.value;
      }
      return settings;
    }, {});
  }

  async listAll() {
    const items = await this.prisma.siteSetting.findMany({
      orderBy: { key: 'asc' },
    });

    return { items };
  }

  async get(key: string) {
    const setting = await this.prisma.siteSetting.findUnique({ where: { key } });

    if (!setting) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }

    return setting;
  }

  async upsert(key: string, value: unknown, actorUserId?: string) {
    this.assertKey(key);

    if (value === undefined || value === null) {
      throw new BadRequestException('Setting value is required');
    }

    const setting = await this.prisma.siteSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'setting.updated',
      entityType: 'SiteSetting',
      entityId: key,
      metadata: { key },
    });

    return setting;
  }

  async upsertMany(settings: Record<string, unknown>, actorUserId?: string) {
    const entries = Object.entries(settings);

    if (entries.length === 0) {
      throw new BadRequestException('No settings were provided');
    }

    for (const [key, value] of entries) {
      this.assertKey(key);
      if (value === undefined || value === null) {
        throw new BadRequestException(`Setting "${key}" has no value`);
      }
    }

    const results = await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.siteSetting.upsert({
          where: { key },
          update: { value: value as Prisma.InputJsonValue },
          create: { key, value: value as Prisma.InputJsonValue },
        }),
      ),
    );

    await this.audit.log({
      userId: actorUserId,
      action: 'settings.bulk-updated',
      entityType: 'SiteSetting',
      metadata: { keys: entries.map(([key]) => key) },
    });

    return { items: results };
  }

  async remove(key: string, actorUserId?: string) {
    this.assertKey(key);

    const existing = await this.prisma.siteSetting.findUnique({ where: { key } });

    if (!existing) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }

    await this.prisma.siteSetting.delete({ where: { key } });

    await this.audit.log({
      userId: actorUserId,
      action: 'setting.deleted',
      entityType: 'SiteSetting',
      entityId: key,
      metadata: { key },
    });

    return { key };
  }

  private assertKey(key: string) {
    if (!key || FORBIDDEN_KEYS.has(key) || !/^[a-zA-Z0-9._-]+$/.test(key)) {
      throw new BadRequestException('Invalid setting key');
    }
  }
}
