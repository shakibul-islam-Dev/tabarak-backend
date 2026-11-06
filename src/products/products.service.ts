import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { buildPaginationMeta, getSkipTake } from '../common/utils/pagination';
import { randomSuffix, slugify } from '../common/utils/slug';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AddVariantDto, UpdateProductDto, UpdateVariantDto } from './dto/update-product.dto';
import { AdminProductQueryDto, ProductQueryDto, ProductSort } from './dto/product-query.dto';

const productInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  attributes: { orderBy: { sortOrder: 'asc' } },
  categories: { include: { category: true } },
  collections: { include: { collection: true } },
  variants: {
    include: {
      inventory: true,
      images: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProductInclude;

type ProductPayload = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const sortToOrderBy = (
  sort: ProductSort | undefined,
): Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] => {
  switch (sort) {
    case 'oldest':
      return { createdAt: 'asc' };
    case 'price-asc':
      return { basePrice: 'asc' };
    case 'price-desc':
      return { basePrice: 'desc' };
    case 'name-asc':
      return { name: 'asc' };
    case 'name-desc':
      return { name: 'desc' };
    case 'featured':
      return [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    case 'best-sellers':
      return { orderItems: { _count: 'desc' } };
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: ProductQueryDto) {
    return this.findAll(query, true);
  }

  async search(query: ProductQueryDto) {
    return this.findAll({ ...query, sort: query.sort ?? 'newest' }, true);
  }

  async findFeatured(query: ProductQueryDto) {
    return this.findAll({ ...query, featured: true }, true);
  }

  async findNewArrivals(query: ProductQueryDto) {
    return this.findAll({ ...query, sort: 'newest' }, true);
  }

  async findBestSellers(query: ProductQueryDto) {
    return this.findAll({ ...query, sort: 'best-sellers' }, true);
  }

  async findAll(query: ProductQueryDto, publicView: boolean) {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const where = this.buildWhere(query, publicView);

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: sortToOrderBy(query.sort),
        skip,
        take,
      }),
    ]);

    return {
      items: products.map((product) => this.mapProduct(product, publicView)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findPublicBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProduct(product, true);
  }

  async findAdminById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProduct(product, false);
  }

  async create(dto: CreateProductDto) {
    const slug = await this.uniqueSlug(dto.slug ?? dto.name);
    const status = dto.status ?? ProductStatus.DRAFT;

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        shortDescription: dto.shortDescription,
        status,
        isFeatured: dto.isFeatured ?? false,
        basePrice: dto.basePrice,
        compareAtPrice: dto.compareAtPrice,
        sku: dto.sku,
        weight: dto.weight,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        publishedAt: status === ProductStatus.ACTIVE ? new Date() : null,
        images: dto.images?.length
          ? {
              create: dto.images.map((image, index) => ({
                url: image.url,
                alt: image.alt,
                sortOrder: image.sortOrder ?? index,
                isPrimary: image.isPrimary ?? index === 0,
              })),
            }
          : undefined,
        attributes: dto.attributes?.length
          ? {
              create: dto.attributes.map((attribute, index) => ({
                name: attribute.name,
                value: attribute.value,
                sortOrder: attribute.sortOrder ?? index,
              })),
            }
          : undefined,
        categories: dto.categoryIds?.length
          ? {
              create: dto.categoryIds.map((categoryId, index) => ({
                category: { connect: { id: categoryId } },
                isPrimary: index === 0,
              })),
            }
          : undefined,
        collections: dto.collectionIds?.length
          ? {
              create: dto.collectionIds.map((collectionId) => ({
                collection: { connect: { id: collectionId } },
              })),
            }
          : undefined,
        variants: dto.variants?.length
          ? { create: dto.variants.map((variant) => this.variantCreateData(variant)) }
          : undefined,
      },
      include: productInclude,
    });

    return this.mapProduct(product, false);
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, publishedAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const data: Prisma.ProductUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = await this.uniqueSlug(dto.slug, id);
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.shortDescription !== undefined) data.shortDescription = dto.shortDescription;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isFeatured !== undefined) data.isFeatured = dto.isFeatured;
    if (dto.basePrice !== undefined) data.basePrice = dto.basePrice;
    if (dto.compareAtPrice !== undefined) data.compareAtPrice = dto.compareAtPrice;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined) data.metaDescription = dto.metaDescription;

    if (dto.status === ProductStatus.ACTIVE && !existing.publishedAt) {
      data.publishedAt = new Date();
    }

    if (dto.images !== undefined) {
      data.images = {
        deleteMany: {},
        create: dto.images.map((image, index) => ({
          url: image.url,
          alt: image.alt,
          sortOrder: image.sortOrder ?? index,
          isPrimary: image.isPrimary ?? index === 0,
        })),
      };
    }

    if (dto.attributes !== undefined) {
      data.attributes = {
        deleteMany: {},
        create: dto.attributes.map((attribute, index) => ({
          name: attribute.name,
          value: attribute.value,
          sortOrder: attribute.sortOrder ?? index,
        })),
      };
    }

    if (dto.categoryIds !== undefined) {
      data.categories = {
        deleteMany: {},
        create: dto.categoryIds.map((categoryId, index) => ({
          category: { connect: { id: categoryId } },
          isPrimary: index === 0,
        })),
      };
    }

    if (dto.collectionIds !== undefined) {
      data.collections = {
        deleteMany: {},
        create: dto.collectionIds.map((collectionId) => ({
          collection: { connect: { id: collectionId } },
        })),
      };
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: productInclude,
    });

    return this.mapProduct(product, false);
  }

  async setStatus(id: string, status: ProductStatus) {
    await this.assertExists(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        status,
        ...(status === ProductStatus.ACTIVE ? { publishedAt: new Date() } : {}),
      },
      include: productInclude,
    });

    return this.mapProduct(product, false);
  }

  async setFeatured(id: string, isFeatured: boolean) {
    await this.assertExists(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: { isFeatured },
      include: productInclude,
    });

    return this.mapProduct(product, false);
  }

  async archive(id: string) {
    await this.assertExists(id);
    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });

    return { id, status: ProductStatus.ARCHIVED };
  }

  async addVariant(productId: string, dto: AddVariantDto) {
    await this.assertExists(productId);

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        ...this.variantCreateData(dto),
      },
      include: { inventory: true, images: true },
    });

    return variant;
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const data: Prisma.ProductVariantUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.compareAtPrice !== undefined) data.compareAtPrice = dto.compareAtPrice;
    if (dto.size !== undefined) data.size = dto.size;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.material !== undefined) data.material = dto.material;
    if (dto.style !== undefined) data.style = dto.style;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.images !== undefined) {
      data.images = {
        deleteMany: {},
        create: dto.images.map((image, index) => ({
          url: image.url,
          alt: image.alt,
          sortOrder: image.sortOrder ?? index,
          isPrimary: image.isPrimary ?? index === 0,
        })),
      };
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data,
      include: { inventory: true, images: true },
    });
  }

  async deleteVariant(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    await this.prisma.productVariant.delete({ where: { id: variantId } });

    return { id: variantId, deleted: true };
  }

  private buildWhere(query: ProductQueryDto, publicView: boolean): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (publicView) {
      where.status = ProductStatus.ACTIVE;
    } else {
      const status = (query as AdminProductQueryDto).status;
      if (status) {
        where.status = status;
      }
    }

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { shortDescription: { contains: query.q, mode: 'insensitive' } },
        { sku: { contains: query.q, mode: 'insensitive' } },
        {
          variants: {
            some: { sku: { contains: query.q, mode: 'insensitive' } },
          },
        },
      ];
    }

    if (query.category) {
      where.categories = { some: { category: { slug: query.category } } };
    }

    if (query.collection) {
      where.collections = {
        some: { collection: { slug: query.collection, isPublished: true } },
      };
    }

    if (query.featured !== undefined) {
      where.isFeatured = query.featured;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    if (query.inStock) {
      where.variants = {
        some: {
          isActive: true,
          inventory: { quantity: { gt: 0 } },
        },
      };
    }

    return where;
  }

  private mapProduct(product: ProductPayload, publicView: boolean) {
    const variants = product.variants
      .filter((variant) => (publicView ? variant.isActive : true))
      .map((variant) => {
        const inventory = variant.inventory;
        const tracked = inventory?.trackInventory ?? false;
        const available = tracked
          ? Math.max(0, (inventory?.quantity ?? 0) - (inventory?.reservedQuantity ?? 0))
          : null;

        return {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          size: variant.size,
          color: variant.color,
          material: variant.material,
          style: variant.style,
          attributes: variant.attributes,
          isActive: variant.isActive,
          stock: available,
          inStock: tracked ? (available ?? 0) > 0 : true,
          lowStockThreshold: inventory?.lowStockThreshold ?? null,
          images: variant.images,
        };
      });

    const variantPrices = variants.map((variant) => Number(variant.price));
    const primaryImage =
      product.images.find((image) => image.isPrimary) ??
      product.images[0] ??
      variants.flatMap((variant) => variant.images)[0] ??
      null;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      status: product.status,
      isFeatured: product.isFeatured,
      basePrice: product.basePrice,
      compareAtPrice: product.compareAtPrice,
      sku: product.sku,
      weight: product.weight,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      publishedAt: product.publishedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      images: product.images,
      attributes: product.attributes,
      categories: product.categories.map((item) => ({
        ...item.category,
        isPrimary: item.isPrimary,
      })),
      collections: product.collections.map((item) => ({
        ...item.collection,
        sortOrder: item.sortOrder,
      })),
      variants,
      priceRange:
        variantPrices.length > 0
          ? { min: Math.min(...variantPrices), max: Math.max(...variantPrices) }
          : null,
      inStock: variants.some((variant) => variant.inStock),
      primaryImage,
    };
  }

  private variantCreateData(
    variant: AddVariantDto,
  ): Prisma.ProductVariantCreateWithoutProductInput {
    return {
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      size: variant.size,
      color: variant.color,
      material: variant.material,
      style: variant.style,
      attributes: variant.attributes as Prisma.InputJsonValue | undefined,
      isActive: variant.isActive ?? true,
      inventory: {
        create: {
          quantity: variant.stock ?? 0,
          lowStockThreshold: variant.lowStockThreshold ?? 5,
        },
      },
    };
  }

  private async assertExists(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async uniqueSlug(value: string, excludeId?: string): Promise<string> {
    const base = slugify(value) || `product-${randomSuffix()}`;
    let candidate = base;
    let counter = 2;

    for (;;) {
      const existing = await this.prisma.product.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing || existing.id === excludeId) {
        return candidate;
      }

      candidate = `${base}-${counter}`;
      counter += 1;

      if (counter > 1000) {
        throw new BadRequestException('Unable to generate a unique slug');
      }
    }
  }
}
