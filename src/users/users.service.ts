import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { buildPaginationMeta, getSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../database/prisma.service';
import {
  AdminUserQueryDto,
  AssignRoleDto,
  CreateModeratorDto,
  UpdateModeratorDto,
  UpdateUserStatusDto,
} from './dto/user.dto';
import { ADMIN_ROLE_SLUGS, classifyUserRole, isAdminRole, isModeratorRole } from './user-roles';

const userInclude = {
  admin: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
  customer: {
    select: {
      id: true,
      phone: true,
      status: true,
      marketingOptIn: true,
      createdAt: true,
      _count: { select: { orders: true, addresses: true } },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = getSkipTake(page, limit);

    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.role === 'ADMIN') {
      where.admin = { is: { role: { slug: { in: [...ADMIN_ROLE_SLUGS] } } } };
    } else if (query.role === 'MODERATOR') {
      where.admin = {
        is: { role: { slug: { notIn: [...ADMIN_ROLE_SLUGS] } } },
      };
    } else if (query.role === 'CUSTOMER') {
      where.admin = { is: null };
    }

    if (query.isActive !== undefined) {
      where.AND = [
        query.isActive
          ? {
              OR: [
                { admin: { is: { isActive: true } } },
                {
                  admin: { is: null },
                  customer: { is: { status: CustomerStatus.ACTIVE } },
                },
              ],
            }
          : {
              OR: [
                { admin: { is: { isActive: false } } },
                {
                  admin: { is: null },
                  customer: { is: { status: CustomerStatus.DISABLED } },
                },
              ],
            },
      ];
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      items: users.map((user) => this.toResponse(user)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  findModerators(query: AdminUserQueryDto) {
    return this.findAll({ ...query, role: 'MODERATOR' });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  async createModerator(actorUserId: string, dto: CreateModeratorDto) {
    await this.getActor(actorUserId);

    if (!isModeratorRole(dto.roleSlug)) {
      throw new BadRequestException('Moderators must be assigned a moderator role');
    }

    const role = await this.getRoleOrThrow(dto.roleSlug);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(dto.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          name: dto.name.trim(),
          email,
          emailVerified: true,
        },
      });

      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: 'credential',
          userId,
          password: passwordHash,
        },
      });

      await tx.adminProfile.create({
        data: {
          userId,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          roleId: role.id,
          isActive: true,
        },
      });
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'moderator.created',
      entityType: 'AdminProfile',
      entityId: userId,
      metadata: { email, role: role.slug },
    });

    return this.findOne(userId);
  }

  async assignRole(actorUserId: string, targetUserId: string, dto: AssignRoleDto) {
    const actor = await this.getActor(actorUserId);

    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const target = await this.getTargetUser(targetUserId);
    const currentRole = classifyUserRole(target.admin?.role.slug);

    if (dto.roleSlug === 'customer') {
      if (currentRole === 'CUSTOMER') {
        return this.findOne(targetUserId);
      }

      if (currentRole === 'ADMIN' && actor.role.slug !== 'super-admin') {
        throw new ForbiddenException('Only a super administrator can demote an administrator');
      }

      if (currentRole === 'ADMIN') {
        await this.assertAnotherActiveAdminExists(targetUserId);
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.adminProfile.deleteMany({ where: { userId: targetUserId } });
        await tx.customerProfile.upsert({
          where: { userId: targetUserId },
          update: {},
          create: { userId: targetUserId, wishlist: { create: {} } },
        });
      });

      await this.audit.log({
        userId: actorUserId,
        action: 'user.role.changed',
        entityType: 'User',
        entityId: targetUserId,
        metadata: { from: target.admin?.role.slug, to: 'customer' },
      });

      return this.findOne(targetUserId);
    }

    const role = await this.getRoleOrThrow(dto.roleSlug);

    if (isAdminRole(role.slug)) {
      if (actor.role.slug !== 'super-admin') {
        throw new ForbiddenException('Only a super administrator can assign administrator roles');
      }
    } else if (isModeratorRole(role.slug)) {
      if (currentRole === 'ADMIN') {
        if (actor.role.slug !== 'super-admin') {
          throw new ForbiddenException(
            'Only a super administrator can change an administrator account',
          );
        }

        await this.assertAnotherActiveAdminExists(targetUserId);
      }
    } else {
      throw new BadRequestException('Unknown or unsupported role');
    }

    await this.prisma.adminProfile.upsert({
      where: { userId: targetUserId },
      update: { roleId: role.id, isActive: true },
      create: { userId: targetUserId, roleId: role.id, isActive: true },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'user.role.changed',
      entityType: 'User',
      entityId: targetUserId,
      metadata: { from: target.admin?.role.slug ?? 'customer', to: role.slug },
    });

    return this.findOne(targetUserId);
  }

  async updateStatus(actorUserId: string, targetUserId: string, dto: UpdateUserStatusDto) {
    await this.getActor(actorUserId);

    if (actorUserId === targetUserId && !dto.isActive) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const target = await this.getTargetUser(targetUserId);

    if (target.admin) {
      if (!dto.isActive && isAdminRole(target.admin.role.slug)) {
        await this.assertAnotherActiveAdminExists(targetUserId);
      }

      await this.prisma.adminProfile.update({
        where: { userId: targetUserId },
        data: { isActive: dto.isActive },
      });
    } else {
      await this.prisma.customerProfile.upsert({
        where: { userId: targetUserId },
        update: {
          status: dto.isActive ? CustomerStatus.ACTIVE : CustomerStatus.DISABLED,
        },
        create: {
          userId: targetUserId,
          status: dto.isActive ? CustomerStatus.ACTIVE : CustomerStatus.DISABLED,
          wishlist: { create: {} },
        },
      });
    }

    await this.audit.log({
      userId: actorUserId,
      action: dto.isActive ? 'user.activated' : 'user.deactivated',
      entityType: 'User',
      entityId: targetUserId,
      metadata: {
        role: classifyUserRole(target.admin?.role.slug),
      },
    });

    return this.findOne(targetUserId);
  }

  async updateModerator(actorUserId: string, targetUserId: string, dto: UpdateModeratorDto) {
    await this.getActor(actorUserId);
    const target = await this.getTargetUser(targetUserId);

    if (!target.admin) {
      throw new BadRequestException('User is not a moderator');
    }

    if (isAdminRole(target.admin.role.slug)) {
      throw new BadRequestException('Use the user role endpoint to manage administrator accounts');
    }

    let roleId: string | undefined;

    if (dto.roleSlug) {
      if (!isModeratorRole(dto.roleSlug)) {
        throw new BadRequestException('Moderators must be assigned a moderator role');
      }

      const role = await this.getRoleOrThrow(dto.roleSlug);
      roleId = role.id;
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.user.update({
          where: { id: targetUserId },
          data: { name: dto.name.trim() },
        });
      }

      await tx.adminProfile.update({
        where: { userId: targetUserId },
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() || null } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() || null } : {}),
          ...(roleId ? { roleId } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'moderator.updated',
      entityType: 'AdminProfile',
      entityId: targetUserId,
      metadata: {
        ...(roleId ? { role: dto.roleSlug } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return this.findOne(targetUserId);
  }

  async deactivateModerator(actorUserId: string, targetUserId: string) {
    await this.getActor(actorUserId);

    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const target = await this.getTargetUser(targetUserId);

    if (!target.admin) {
      throw new BadRequestException('User is not a moderator');
    }

    if (isAdminRole(target.admin.role.slug)) {
      throw new BadRequestException(
        'Administrators must be deactivated through user status management',
      );
    }

    await this.prisma.adminProfile.update({
      where: { userId: targetUserId },
      data: { isActive: false },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'moderator.deactivated',
      entityType: 'AdminProfile',
      entityId: targetUserId,
      metadata: { role: target.admin.role.slug },
    });

    return this.findOne(targetUserId);
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { admins: true } },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.admins,
      permissions: role.permissions
        .map((entry) => entry.permission.key)
        .sort((left, right) => left.localeCompare(right)),
    }));
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  private async getActor(actorUserId: string) {
    const actor = await this.prisma.adminProfile.findUnique({
      where: { userId: actorUserId },
      include: { role: true },
    });

    if (!actor || !actor.isActive) {
      throw new ForbiddenException('An active administrator account is required');
    }

    return actor;
  }

  private async getTargetUser(targetUserId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        admin: { include: { role: true } },
        customer: { select: { id: true } },
      },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    return target;
  }

  private async getRoleOrThrow(slug: string) {
    const role = await this.prisma.role.findUnique({ where: { slug } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  /**
   * Blocks demoting or deactivating the only remaining active administrator,
   * preventing an accidental store lockout.
   */
  private async assertAnotherActiveAdminExists(excludedUserId: string): Promise<void> {
    const remaining = await this.prisma.adminProfile.count({
      where: {
        userId: { not: excludedUserId },
        isActive: true,
        role: { slug: { in: [...ADMIN_ROLE_SLUGS] } },
      },
    });

    if (remaining === 0) {
      throw new BadRequestException('At least one active administrator must remain');
    }
  }

  private toResponse(user: UserWithAccess) {
    const role = classifyUserRole(user.admin?.role.slug);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role,
      isActive:
        role === 'CUSTOMER'
          ? user.customer?.status !== CustomerStatus.DISABLED
          : user.admin?.isActive === true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      admin: user.admin
        ? {
            id: user.admin.id,
            firstName: user.admin.firstName,
            lastName: user.admin.lastName,
            isActive: user.admin.isActive,
            role: {
              id: user.admin.role.id,
              name: user.admin.role.name,
              slug: user.admin.role.slug,
            },
            permissions: user.admin.role.permissions
              .map((entry) => entry.permission.key)
              .sort((left, right) => left.localeCompare(right)),
          }
        : null,
      customer: user.customer
        ? {
            id: user.customer.id,
            phone: user.customer.phone,
            status: user.customer.status,
            marketingOptIn: user.customer.marketingOptIn,
            createdAt: user.customer.createdAt,
            orders: user.customer._count.orders,
            addresses: user.customer._count.addresses,
          }
        : null,
    };
  }
}
