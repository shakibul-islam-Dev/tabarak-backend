import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildPaginationMeta, getSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../database/prisma.service';

export interface AuditLogInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an administrative action. Audit failures must never break the
   * primary operation, so errors are logged only.
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          metadata: input.metadata,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${input.action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async list(query: { page: number; limit: number; entityType?: string; userId?: string }) {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      items: logs,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}
