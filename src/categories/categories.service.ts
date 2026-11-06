import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomSuffix, slugify } from '../common/utils/slug';
import { PrismaService } from '../database/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const categoryInclude = {
  _count: { select: { products: true, children: true } },
} satisfies Prisma.CategoryInclude;

type CategoryPayload = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  children: CategoryNode[];
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findTree(activeOnly = true): Promise<CategoryNode[]> {
    const categories = await this.prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const nodes = new Map<string, CategoryNode>();
    for (const category of categories) {
      nodes.set(category.id, this.toNode(category));
    }

    const roots: CategoryNode[] = [];
    for (const category of categories) {
      const node = nodes.get(category.id)!;
      if (category.parentId && nodes.has(category.parentId)) {
        nodes.get(category.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findAllFlat() {
    const categories = await this.prisma.category.findMany({
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((category) => this.toNode(category));
  }

  async findPublicBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true },
      include: {
        ...categoryInclude,
        children: {
          where: { isActive: true },
          include: categoryInclude,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      ...this.toNode(category),
      children: category.children.map((child) => this.toNode(child)),
    };
  }

  async findAdminById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: categoryInclude,
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.toNode(category);
  }

  async create(dto: CreateCategoryDto) {
    const slug = await this.uniqueSlug(dto.slug ?? dto.name);

    if (dto.parentId) {
      await this.assertExists(dto.parentId);
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        parentId: dto.parentId ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: categoryInclude,
    });

    return this.toNode(category);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.assertExists(id);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.assertExists(dto.parentId);
      await this.assertNoCycle(id, dto.parentId);
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: await this.uniqueSlug(dto.slug, id) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle } : {}),
        ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: categoryInclude,
    });

    return this.toNode(category);
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.category.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertNoCycle(categoryId: string, parentId: string): Promise<void> {
    let current: string | null = parentId;
    let depth = 0;

    while (current && depth < 50) {
      if (current === categoryId) {
        throw new BadRequestException('Category hierarchy cannot contain a cycle');
      }

      const parent: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });

      current = parent?.parentId ?? null;
      depth += 1;
    }
  }

  private async assertExists(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async uniqueSlug(value: string, excludeId?: string): Promise<string> {
    const base = slugify(value) || `category-${randomSuffix()}`;
    let candidate = base;
    let counter = 2;

    for (;;) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing || existing.id === excludeId) {
        return candidate;
      }

      candidate = `${base}-${counter}`;
      counter += 1;
    }
  }

  private toNode(category: CategoryPayload): CategoryNode {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      metaTitle: category.metaTitle,
      metaDescription: category.metaDescription,
      parentId: category.parentId,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      productCount: category._count.products,
      children: [],
    };
  }
}
