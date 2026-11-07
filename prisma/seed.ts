/**
 * tabarak database seed.
 *
 * Usage:
 *   pnpm prisma:migrate   # create the schema first
 *   pnpm db:seed
 *
 * The seed is idempotent: it upserts permissions, roles, the admin account,
 * categories, collections, products, shipping and coupons without duplicating
 * rows. Existing customer/admin passwords are never overwritten.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DiscountType,
  OrderStatus,
  Prisma,
  PrismaClient,
  ProductStatus,
} from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { PERMISSIONS } from '../src/common/constants/permissions';

function loadEnvFile(): void {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envPath = join(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile();

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@tabarak.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'tabarak Admin';

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  [PERMISSIONS.DASHBOARD_VIEW]: 'View the administration dashboard',
  [PERMISSIONS.PRODUCTS_READ]: 'View products in the administration area',
  [PERMISSIONS.PRODUCTS_MANAGE]: 'Create, update, publish and archive products',
  [PERMISSIONS.CATEGORIES_MANAGE]: 'Manage product categories',
  [PERMISSIONS.COLLECTIONS_MANAGE]: 'Manage product collections',
  [PERMISSIONS.INVENTORY_READ]: 'View inventory levels and movements',
  [PERMISSIONS.INVENTORY_MANAGE]: 'Adjust inventory and reservations',
  [PERMISSIONS.ORDERS_READ]: 'View orders and customer order details',
  [PERMISSIONS.ORDERS_MANAGE]: 'Update order status and manage shipments',
  [PERMISSIONS.CUSTOMERS_READ]: 'View customer profiles and order history',
  [PERMISSIONS.CUSTOMERS_MANAGE]: 'Enable or disable customer accounts',
  [PERMISSIONS.USERS_READ]: 'View users, staff roles and permissions',
  [PERMISSIONS.USERS_MANAGE]: 'Create, update and deactivate moderator accounts',
  [PERMISSIONS.ROLES_MANAGE]: 'Assign and revoke user roles',
  [PERMISSIONS.COUPONS_MANAGE]: 'Manage coupons and discounts',
  [PERMISSIONS.SHIPPING_MANAGE]: 'Manage shipping zones and methods',
  [PERMISSIONS.CONTENT_MANAGE]: 'Manage storefront content and newsletter',
  [PERMISSIONS.SETTINGS_MANAGE]: 'Manage store settings',
  [PERMISSIONS.UPLOADS_MANAGE]: 'Upload and delete media files',
  [PERMISSIONS.AUDIT_READ]: 'View the administrative audit log',
};

const ROLE_DEFINITIONS: Array<{
  name: string;
  slug: string;
  description: string;
  permissions: string[];
}> = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'Unrestricted access to every administration feature',
    permissions: Object.values(PERMISSIONS),
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Full store administration',
    permissions: Object.values(PERMISSIONS),
  },
  {
    name: 'Product Manager',
    slug: 'product-manager',
    description: 'Catalog and inventory management',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_MANAGE,
      PERMISSIONS.CATEGORIES_MANAGE,
      PERMISSIONS.COLLECTIONS_MANAGE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.UPLOADS_MANAGE,
    ],
  },
  {
    name: 'Order Manager',
    slug: 'order-manager',
    description: 'Order fulfilment, shipping and customer support',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.SHIPPING_MANAGE,
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.INVENTORY_READ,
    ],
  },
  {
    name: 'Customer Support',
    slug: 'customer-support',
    description: 'Customer and order support without catalog access',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.CUSTOMERS_MANAGE,
    ],
  },
];

const CATEGORY_DEFINITIONS: Array<{
  name: string;
  slug: string;
  description: string;
  parentSlug?: string;
  sortOrder: number;
}> = [
  {
    name: 'Women',
    slug: 'women',
    description: 'Minimal, considered pieces for everyday wear.',
    sortOrder: 1,
  },
  {
    name: 'Knitwear',
    slug: 'knitwear',
    description: 'Soft merino and cotton knits.',
    parentSlug: 'women',
    sortOrder: 1,
  },
  {
    name: 'Dresses',
    slug: 'dresses',
    description: 'Relaxed silhouettes in natural fabrics.',
    parentSlug: 'women',
    sortOrder: 2,
  },
  {
    name: 'Men',
    slug: 'men',
    description: 'Quiet staples built to last.',
    sortOrder: 2,
  },
  {
    name: 'Shirts',
    slug: 'shirts',
    description: 'Linen and cotton shirting.',
    parentSlug: 'men',
    sortOrder: 1,
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Leather goods and small essentials.',
    sortOrder: 3,
  },
  {
    name: 'Home',
    slug: 'home',
    description: 'Objects for slow mornings.',
    sortOrder: 4,
  },
];

const COLLECTION_DEFINITIONS: Array<{
  name: string;
  slug: string;
  description: string;
  isFeatured: boolean;
  sortOrder: number;
  productSlugs: string[];
}> = [
  {
    name: 'New Arrivals',
    slug: 'new-arrivals',
    description: 'The latest additions to the tabarak wardrobe.',
    isFeatured: true,
    sortOrder: 1,
    productSlugs: [
      'essential-cotton-tee',
      'relaxed-linen-shirt',
      'merino-wool-sweater',
      'minimal-leather-tote',
      'ceramic-pour-over-set',
    ],
  },
  {
    name: 'Best Sellers',
    slug: 'best-sellers',
    description: 'The pieces our customers return to.',
    isFeatured: true,
    sortOrder: 2,
    productSlugs: [
      'essential-cotton-tee',
      'tailored-wide-leg-trousers',
      'minimal-leather-tote',
    ],
  },
  {
    name: 'Essentials',
    slug: 'essentials',
    description: 'A capsule of everyday foundations.',
    isFeatured: false,
    sortOrder: 3,
    productSlugs: [
      'essential-cotton-tee',
      'relaxed-linen-shirt',
      'tailored-wide-leg-trousers',
    ],
  },
];

interface SeedVariant {
  name: string;
  sku: string;
  price: string;
  compareAtPrice?: string;
  size?: string;
  color?: string;
  material?: string;
  style?: string;
  stock: number;
  lowStockThreshold?: number;
}

interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  basePrice: string;
  compareAtPrice?: string;
  sku: string;
  status?: ProductStatus;
  isFeatured?: boolean;
  categorySlugs: string[];
  attributes: Array<{ name: string; value: string }>;
  images: Array<{ url: string; alt: string }>;
  variants: SeedVariant[];
}

const image = (seed: string): string =>
  `https://picsum.photos/seed/tabarak-${seed}/900/1200`;

const PRODUCT_DEFINITIONS: SeedProduct[] = [
  {
    name: 'Essential Cotton Tee',
    slug: 'essential-cotton-tee',
    description:
      'A heavyweight organic cotton tee with a clean neckline and a relaxed, boxy fit. Garment-dyed for a soft, lived-in hand feel.',
    shortDescription: 'Heavyweight organic cotton, relaxed fit.',
    basePrice: '38.00',
    sku: 'TAB-TEE-001',
    status: ProductStatus.ACTIVE,
    isFeatured: true,
    categorySlugs: ['women', 'knitwear'],
    attributes: [
      { name: 'Material', value: '100% organic cotton' },
      { name: 'Fit', value: 'Relaxed' },
      { name: 'Care', value: 'Machine wash cold' },
    ],
    images: [
      { url: image('tee-bone'), alt: 'Essential Cotton Tee in Bone' },
      { url: image('tee-black'), alt: 'Essential Cotton Tee in Black' },
    ],
    variants: [
      {
        name: 'Bone / XS',
        sku: 'TAB-TEE-001-BONE-XS',
        price: '38.00',
        size: 'XS',
        color: 'Bone',
        stock: 24,
      },
      {
        name: 'Bone / S',
        sku: 'TAB-TEE-001-BONE-S',
        price: '38.00',
        size: 'S',
        color: 'Bone',
        stock: 32,
      },
      {
        name: 'Bone / M',
        sku: 'TAB-TEE-001-BONE-M',
        price: '38.00',
        size: 'M',
        color: 'Bone',
        stock: 28,
      },
      {
        name: 'Black / M',
        sku: 'TAB-TEE-001-BLACK-M',
        price: '38.00',
        size: 'M',
        color: 'Black',
        stock: 18,
      },
    ],
  },
  {
    name: 'Relaxed Linen Shirt',
    slug: 'relaxed-linen-shirt',
    description:
      'Cut from washed European linen, this shirt has a soft collar, dropped shoulder and a gently curved hem.',
    shortDescription: 'Washed European linen with a relaxed collar.',
    basePrice: '89.00',
    compareAtPrice: '109.00',
    sku: 'TAB-SHT-001',
    status: ProductStatus.ACTIVE,
    isFeatured: true,
    categorySlugs: ['men', 'shirts'],
    attributes: [
      { name: 'Material', value: '100% European linen' },
      { name: 'Fit', value: 'Relaxed' },
      { name: 'Care', value: 'Machine wash cold, line dry' },
    ],
    images: [
      { url: image('linen-sand'), alt: 'Relaxed Linen Shirt in Sand' },
      { url: image('linen-white'), alt: 'Relaxed Linen Shirt in White' },
    ],
    variants: [
      {
        name: 'Sand / S',
        sku: 'TAB-SHT-001-SAND-S',
        price: '89.00',
        compareAtPrice: '109.00',
        size: 'S',
        color: 'Sand',
        stock: 12,
      },
      {
        name: 'Sand / M',
        sku: 'TAB-SHT-001-SAND-M',
        price: '89.00',
        compareAtPrice: '109.00',
        size: 'M',
        color: 'Sand',
        stock: 16,
      },
      {
        name: 'White / L',
        sku: 'TAB-SHT-001-WHITE-L',
        price: '89.00',
        compareAtPrice: '109.00',
        size: 'L',
        color: 'White',
        stock: 9,
      },
    ],
  },
  {
    name: 'Merino Wool Sweater',
    slug: 'merino-wool-sweater',
    description:
      'A fine-gauge merino sweater with a slightly cropped body and ribbed trims. Light enough to layer, warm enough for winter.',
    shortDescription: 'Fine-gauge merino with ribbed trims.',
    basePrice: '129.00',
    sku: 'TAB-KNT-001',
    status: ProductStatus.ACTIVE,
    isFeatured: false,
    categorySlugs: ['women', 'knitwear'],
    attributes: [
      { name: 'Material', value: '100% merino wool' },
      { name: 'Fit', value: 'Regular' },
      { name: 'Care', value: 'Hand wash cold' },
    ],
    images: [{ url: image('sweater-oat'), alt: 'Merino Wool Sweater in Oat' }],
    variants: [
      {
        name: 'Oat / XS',
        sku: 'TAB-KNT-001-OAT-XS',
        price: '129.00',
        size: 'XS',
        color: 'Oat',
        stock: 8,
      },
      {
        name: 'Oat / S',
        sku: 'TAB-KNT-001-OAT-S',
        price: '129.00',
        size: 'S',
        color: 'Oat',
        stock: 14,
      },
      {
        name: 'Oat / M',
        sku: 'TAB-KNT-001-OAT-M',
        price: '129.00',
        size: 'M',
        color: 'Oat',
        stock: 4,
        lowStockThreshold: 6,
      },
    ],
  },
  {
    name: 'Tailored Wide-Leg Trousers',
    slug: 'tailored-wide-leg-trousers',
    description:
      'High-waisted trousers with a fluid wide leg, side pockets and a concealed hook closure.',
    shortDescription: 'Fluid wide leg with a high waist.',
    basePrice: '119.00',
    sku: 'TAB-TRS-001',
    status: ProductStatus.ACTIVE,
    isFeatured: false,
    categorySlugs: ['women'],
    attributes: [
      { name: 'Material', value: '68% viscose, 32% linen' },
      { name: 'Fit', value: 'Wide leg, high waist' },
      { name: 'Care', value: 'Dry clean' },
    ],
    images: [{ url: image('trousers-charcoal'), alt: 'Tailored Wide-Leg Trousers' }],
    variants: [
      {
        name: 'Charcoal / 6',
        sku: 'TAB-TRS-001-CHAR-6',
        price: '119.00',
        size: '6',
        color: 'Charcoal',
        stock: 10,
      },
      {
        name: 'Charcoal / 8',
        sku: 'TAB-TRS-001-CHAR-8',
        price: '119.00',
        size: '8',
        color: 'Charcoal',
        stock: 11,
      },
      {
        name: 'Charcoal / 10',
        sku: 'TAB-TRS-001-CHAR-10',
        price: '119.00',
        size: '10',
        color: 'Charcoal',
        stock: 6,
      },
    ],
  },
  {
    name: 'Minimal Leather Tote',
    slug: 'minimal-leather-tote',
    description:
      'A structured everyday tote in vegetable-tanned leather. Fits a 14-inch laptop, with a zipped interior pocket.',
    shortDescription: 'Vegetable-tanned leather, laptop-friendly.',
    basePrice: '189.00',
    sku: 'TAB-ACC-001',
    status: ProductStatus.ACTIVE,
    isFeatured: true,
    categorySlugs: ['accessories'],
    attributes: [
      { name: 'Material', value: 'Vegetable-tanned leather' },
      { name: 'Dimensions', value: '36 × 30 × 12 cm' },
      { name: 'Care', value: 'Wipe with a soft cloth' },
    ],
    images: [{ url: image('tote-tan'), alt: 'Minimal Leather Tote in Tan' }],
    variants: [
      {
        name: 'Tan',
        sku: 'TAB-ACC-001-TAN',
        price: '189.00',
        color: 'Tan',
        material: 'Leather',
        stock: 15,
      },
      {
        name: 'Black',
        sku: 'TAB-ACC-001-BLACK',
        price: '189.00',
        color: 'Black',
        material: 'Leather',
        stock: 7,
      },
    ],
  },
  {
    name: 'Ceramic Pour-Over Set',
    slug: 'ceramic-pour-over-set',
    description:
      'A hand-thrown stoneware dripper and carafe finished in a matte sand glaze. For slow, deliberate mornings.',
    shortDescription: 'Hand-thrown stoneware dripper and carafe.',
    basePrice: '64.00',
    sku: 'TAB-HOM-001',
    status: ProductStatus.ACTIVE,
    isFeatured: false,
    categorySlugs: ['home'],
    attributes: [
      { name: 'Material', value: 'Stoneware' },
      { name: 'Capacity', value: '600 ml' },
      { name: 'Care', value: 'Dishwasher safe' },
    ],
    images: [{ url: image('pour-over'), alt: 'Ceramic Pour-Over Set' }],
    variants: [
      {
        name: 'Sand',
        sku: 'TAB-HOM-001-SAND',
        price: '64.00',
        color: 'Sand',
        material: 'Stoneware',
        stock: 20,
      },
    ],
  },
];

const SHIPPING_ZONES: Array<{
  name: string;
  countries: string[];
  regions: string[];
  methods: Array<{
    name: string;
    description: string;
    price: string;
    freeShippingThreshold?: string;
    minDeliveryDays: number;
    maxDeliveryDays: number;
  }>;
}> = [
  {
    name: 'United States',
    countries: ['US'],
    regions: [],
    methods: [
      {
        name: 'Standard Shipping',
        description: 'Tracked delivery in 3–5 business days.',
        price: '8.00',
        freeShippingThreshold: '100.00',
        minDeliveryDays: 3,
        maxDeliveryDays: 5,
      },
      {
        name: 'Express Shipping',
        description: 'Tracked delivery in 1–2 business days.',
        price: '18.00',
        minDeliveryDays: 1,
        maxDeliveryDays: 2,
      },
    ],
  },
  {
    name: 'International',
    countries: ['CA', 'GB', 'AU', 'DE', 'FR'],
    regions: [],
    methods: [
      {
        name: 'International Standard',
        description: 'Tracked international delivery in 6–10 business days.',
        price: '24.00',
        freeShippingThreshold: '200.00',
        minDeliveryDays: 6,
        maxDeliveryDays: 10,
      },
    ],
  },
];

async function seedPermissionsAndRoles(): Promise<Map<string, string>> {
  const permissionIds = new Map<string, string>();

  for (const key of Object.values(PERMISSIONS)) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSION_DESCRIPTIONS[key] ?? key },
      create: { key, description: PERMISSION_DESCRIPTIONS[key] ?? key },
    });
    permissionIds.set(key, permission.id);
  }

  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { slug: definition.slug },
      update: {
        name: definition.name,
        description: definition.description,
      },
      create: {
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        isSystem: true,
      },
    });

    await prisma.rolePermission.createMany({
      data: definition.permissions.map((key) => ({
        roleId: role.id,
        permissionId: permissionIds.get(key) as string,
      })),
      skipDuplicates: true,
    });
  }

  const superAdmin = await prisma.role.findUniqueOrThrow({
    where: { slug: 'super-admin' },
  });

  return new Map([[superAdmin.slug, superAdmin.id]]);
}

async function seedAdminUser(superAdminRoleId: string): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: ADMIN_NAME, emailVerified: true },
    create: {
      id: randomUUID(),
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      emailVerified: true,
    },
  });

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential' },
    select: { id: true },
  });

  if (!existingAccount) {
    const password = await hashPassword(ADMIN_PASSWORD);

    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password,
      },
    });
  }

  await prisma.adminProfile.upsert({
    where: { userId: user.id },
    update: { roleId: superAdminRoleId, isActive: true },
    create: {
      userId: user.id,
      firstName: 'tabarak',
      lastName: 'Admin',
      isActive: true,
      roleId: superAdminRoleId,
    },
  });

  console.log(`✔ Admin account ready: ${ADMIN_EMAIL}`);
  if (!existingAccount) {
    console.log(`  Initial password: ${ADMIN_PASSWORD} (change it after first login)`);
  }
}

async function seedCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const definition of CATEGORY_DEFINITIONS) {
    const parentId = definition.parentSlug
      ? ids.get(definition.parentSlug)
      : undefined;

    const category = await prisma.category.upsert({
      where: { slug: definition.slug },
      update: {
        name: definition.name,
        description: definition.description,
        parentId: parentId ?? null,
        sortOrder: definition.sortOrder,
        isActive: true,
      },
      create: {
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        parentId: parentId ?? null,
        sortOrder: definition.sortOrder,
        isActive: true,
      },
    });

    ids.set(definition.slug, category.id);
  }

  return ids;
}

async function seedProducts(categoryIds: Map<string, string>): Promise<void> {
  const productIds = new Map<string, string>();

  for (const definition of PRODUCT_DEFINITIONS) {
    const product = await prisma.product.upsert({
      where: { slug: definition.slug },
      update: {
        name: definition.name,
        description: definition.description,
        shortDescription: definition.shortDescription,
        status: definition.status ?? ProductStatus.ACTIVE,
        isFeatured: definition.isFeatured ?? false,
        basePrice: definition.basePrice,
        compareAtPrice: definition.compareAtPrice ?? null,
        sku: definition.sku,
        publishedAt: new Date(),
      },
      create: {
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        shortDescription: definition.shortDescription,
        status: definition.status ?? ProductStatus.ACTIVE,
        isFeatured: definition.isFeatured ?? false,
        basePrice: definition.basePrice,
        compareAtPrice: definition.compareAtPrice ?? null,
        sku: definition.sku,
        publishedAt: new Date(),
      },
    });

    productIds.set(definition.slug, product.id);

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: definition.images.map((item, index) => ({
        productId: product.id,
        url: item.url,
        alt: item.alt,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    });

    await prisma.productAttribute.deleteMany({ where: { productId: product.id } });
    await prisma.productAttribute.createMany({
      data: definition.attributes.map((attribute, index) => ({
        productId: product.id,
        name: attribute.name,
        value: attribute.value,
        sortOrder: index,
      })),
    });

    await prisma.productCategory.deleteMany({
      where: { productId: product.id },
    });
    await prisma.productCategory.createMany({
      data: definition.categorySlugs.map((slug, index) => ({
        productId: product.id,
        categoryId: categoryIds.get(slug) as string,
        isPrimary: index === 0,
      })),
      skipDuplicates: true,
    });

    for (const variant of definition.variants) {
      const savedVariant = await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: {
          productId: product.id,
          name: variant.name,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice ?? null,
          size: variant.size ?? null,
          color: variant.color ?? null,
          material: variant.material ?? null,
          style: variant.style ?? null,
          isActive: true,
        },
        create: {
          productId: product.id,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice ?? null,
          size: variant.size ?? null,
          color: variant.color ?? null,
          material: variant.material ?? null,
          style: variant.style ?? null,
          isActive: true,
        },
      });

      await prisma.inventory.upsert({
        where: { variantId: savedVariant.id },
        update: {
          lowStockThreshold: variant.lowStockThreshold ?? 5,
          trackInventory: true,
        },
        create: {
          variantId: savedVariant.id,
          quantity: variant.stock,
          lowStockThreshold: variant.lowStockThreshold ?? 5,
          trackInventory: true,
        },
      });
    }
  }

  for (const definition of COLLECTION_DEFINITIONS) {
    const collection = await prisma.collection.upsert({
      where: { slug: definition.slug },
      update: {
        name: definition.name,
        description: definition.description,
        isFeatured: definition.isFeatured,
        isPublished: true,
        sortOrder: definition.sortOrder,
      },
      create: {
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        isFeatured: definition.isFeatured,
        isPublished: true,
        sortOrder: definition.sortOrder,
      },
    });

    await prisma.collectionProduct.deleteMany({
      where: { collectionId: collection.id },
    });
    await prisma.collectionProduct.createMany({
      data: definition.productSlugs.map((slug, index) => ({
        collectionId: collection.id,
        productId: productIds.get(slug) as string,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }
}

async function seedShipping(): Promise<void> {
  for (const zoneDefinition of SHIPPING_ZONES) {
    const existing = await prisma.shippingZone.findFirst({
      where: { name: zoneDefinition.name },
    });

    const zone = existing
      ? await prisma.shippingZone.update({
          where: { id: existing.id },
          data: {
            countries: zoneDefinition.countries,
            regions: zoneDefinition.regions,
            isActive: true,
          },
        })
      : await prisma.shippingZone.create({
          data: {
            name: zoneDefinition.name,
            countries: zoneDefinition.countries,
            regions: zoneDefinition.regions,
            isActive: true,
          },
        });

    for (const method of zoneDefinition.methods) {
      const existingMethod = await prisma.shippingMethod.findFirst({
        where: { zoneId: zone.id, name: method.name },
      });

      const data = {
        zoneId: zone.id,
        name: method.name,
        description: method.description,
        price: method.price,
        freeShippingThreshold: method.freeShippingThreshold ?? null,
        minDeliveryDays: method.minDeliveryDays,
        maxDeliveryDays: method.maxDeliveryDays,
        isActive: true,
      };

      if (existingMethod) {
        await prisma.shippingMethod.update({
          where: { id: existingMethod.id },
          data,
        });
      } else {
        await prisma.shippingMethod.create({ data });
      }
    }
  }
}

async function seedCoupons(): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {
      type: DiscountType.PERCENTAGE,
      value: '10.00',
      minOrderAmount: '50.00',
      maxDiscountAmount: '20.00',
      startsAt: now,
      expiresAt,
      usageLimitPerCustomer: 1,
      isActive: true,
    },
    create: {
      code: 'WELCOME10',
      description: '10% off your first order over $50',
      type: DiscountType.PERCENTAGE,
      value: '10.00',
      minOrderAmount: '50.00',
      maxDiscountAmount: '20.00',
      startsAt: now,
      expiresAt,
      usageLimitPerCustomer: 1,
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'FREESHIP' },
    update: {
      type: DiscountType.FREE_SHIPPING,
      value: '0.00',
      minOrderAmount: '100.00',
      startsAt: now,
      expiresAt,
      isActive: true,
    },
    create: {
      code: 'FREESHIP',
      description: 'Free standard shipping over $100',
      type: DiscountType.FREE_SHIPPING,
      value: '0.00',
      minOrderAmount: '100.00',
      startsAt: now,
      expiresAt,
      isActive: true,
    },
  });
}

async function seedSettings(): Promise<void> {
  const settings: Record<string, Prisma.InputJsonValue> = {
    'site.name': 'tabarak',
    'site.tagline': 'Considered essentials for everyday life',
    'site.description':
      'tabarak is a modern minimalist label creating durable, quietly beautiful pieces.',
    'site.currency': 'USD',
    'site.contactEmail': 'hello@tabarak.local',
    'site.social': {
      instagram: 'https://instagram.com/tabarak',
      pinterest: 'https://pinterest.com/tabarak',
    },
    'shipping.freeShippingThreshold': 100,
    'shipping.defaultCountry': 'US',
    'seo.defaultTitle': 'tabarak — Considered essentials',
    'seo.defaultDescription':
      'Modern minimalist clothing, accessories and objects for everyday life.',
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

async function main(): Promise<void> {
  console.log('Seeding tabarak database...');

  const roles = await seedPermissionsAndRoles();
  const superAdminRoleId = roles.get('super-admin');

  if (!superAdminRoleId) {
    throw new Error('Super admin role was not created');
  }

  await seedAdminUser(superAdminRoleId);
  const categoryIds = await seedCategories();
  await seedProducts(categoryIds);
  await seedShipping();
  await seedCoupons();
  await seedSettings();

  const [products, variants, orders] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.order.count({ where: { status: { not: OrderStatus.CANCELLED } } }),
  ]);

  console.log(
    `✔ Seed complete — ${products} products, ${variants} variants, ${orders} active orders.`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
