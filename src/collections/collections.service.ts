import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomSuffix, slugify } from '../common/utils/slug';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { CollectionQueryDto, CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto';

const collectionInclude = {
  _count: { select: { products: true } },
} satisfies Prisma.CollectionInclude;

type CollectionPayload = Prisma.CollectionGetPayload<{ include: typeof collectionInclude }>;

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async findPublished(featured?: boolean) {
    const collections = await this.prisma.collection.findMany({
      where: {
        isPublished: true,
        ...(featured !== undefined ? { isFeatured: featured } : {}),
      },
      include: collectionInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return collections.map((collection) => this.toResponse(collection));
  }

  async findPublicBySlug(slug: string, query: CollectionQueryDto) {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, isPublished: true },
      include: collectionInclude,
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    const products = await this.productsService.findPublic({
      page: query.page,
      limit: query.limit,
      collection: slug,
    });

    return {
      ...this.toResponse(collection),
      products: products.items,
      productsMeta: products.meta,
    };
  }

  async findAllAdmin() {
    const collections = await this.prisma.collection.findMany({
      include: collectionInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return collections.map((collection) => this.toResponse(collection));
  }

  async findAdminById(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        ...collectionInclude,
        products: {
          include: { product: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return {
      ...this.toResponse(collection),
      products: collection.products.map((item) => ({
        ...item.product,
        sortOrder: item.sortOrder,
      })),
    };
  }

  async create(dto: CreateCollectionDto) {
    const slug = await this.uniqueSlug(dto.slug ?? dto.name);

    const collection = await this.prisma.collection.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        isFeatured: dto.isFeatured ?? false,
        isPublished: dto.isPublished ?? false,
        sortOrder: dto.sortOrder ?? 0,
        products: dto.productIds?.length
          ? {
              create: dto.productIds.map((productId, index) => ({
                product: { connect: { id: productId } },
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: collectionInclude,
    });

    return this.toResponse(collection);
  }

  async update(id: string, dto: UpdateCollectionDto) {
    await this.assertExists(id);

    const collection = await this.prisma.collection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: await this.uniqueSlug(dto.slug, id) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.productIds !== undefined
          ? {
              products: {
                deleteMany: {},
                create: dto.productIds.map((productId, index) => ({
                  product: { connect: { id: productId } },
                  sortOrder: index,
                })),
              },
            }
          : {}),
      },
      include: collectionInclude,
    });

    return this.toResponse(collection);
  }

  async setProducts(id: string, productIds: string[]) {
    await this.assertExists(id);

    const collection = await this.prisma.collection.update({
      where: { id },
      data: {
        products: {
          deleteMany: {},
          create: productIds.map((productId, index) => ({
            product: { connect: { id: productId } },
            sortOrder: index,
          })),
        },
      },
      include: {
        ...collectionInclude,
        products: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    return {
      ...this.toResponse(collection),
      products: collection.products.map((item) => ({
        ...item.product,
        sortOrder: item.sortOrder,
      })),
    };
  }

  async setPublishState(id: string, isPublished: boolean) {
    await this.assertExists(id);
    const collection = await this.prisma.collection.update({
      where: { id },
      data: { isPublished },
      include: collectionInclude,
    });

    return this.toResponse(collection);
  }

  async setFeaturedState(id: string, isFeatured: boolean) {
    await this.assertExists(id);
    const collection = await this.prisma.collection.update({
      where: { id },
      data: { isFeatured },
      include: collectionInclude,
    });

    return this.toResponse(collection);
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.collection.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertExists(id: string): Promise<void> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
  }

  private async uniqueSlug(value: string, excludeId?: string): Promise<string> {
    const base = slugify(value) || `collection-${randomSuffix()}`;
    let candidate = base;
    let counter = 2;

    for (;;) {
      const existing = await this.prisma.collection.findUnique({
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

  private toResponse(collection: CollectionPayload) {
    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      imageUrl: collection.imageUrl,
      isFeatured: collection.isFeatured,
      isPublished: collection.isPublished,
      sortOrder: collection.sortOrder,
      productCount: collection._count.products,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }
}
