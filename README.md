# Tabark Backend

Production-ready REST API for **Tabark**, a modern minimalist e-commerce store.
Built with NestJS, PostgreSQL, Prisma and Better Auth as a modular monolith.

The backend is the source of truth for authentication, pricing, inventory,
coupons, checkout and orders. The Next.js storefront only renders data and
collects user input.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | NestJS 11 + TypeScript |
| Database | PostgreSQL 16+ |
| ORM | Prisma 6 |
| Authentication | Better Auth (email + password sessions) |
| Validation | class-validator + class-transformer |
| Uploads | Multer (local disk storage) |
| Email | Nodemailer + SMTP |
| Security | Helmet, CORS, Throttler, RBAC guards |
| Tests | Jest + Supertest |

Deliberately **not** included: Redis, BullMQ, Swagger/OpenAPI, Pino, S3,
Cloudinary, payment gateways, Docker and microservices.

## Requirements

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tabark?schema=public
BETTER_AUTH_SECRET=replace-with-a-long-random-string
```

Generate a secret with:

```bash
openssl rand -hex 32
```

Create the database, run the migration and seed the store:

```bash
pnpm prisma:generate
pnpm prisma:migrate --name init   # first local setup
pnpm db:seed
pnpm start:dev
```

The API listens on `http://localhost:4000` and the health check is:

```bash
curl http://localhost:4000/api/v1/health
```

### Seeded admin account

| Setting | Default | Environment variable |
| --- | --- | --- |
| Email | `admin@tabark.local` | `SEED_ADMIN_EMAIL` |
| Password | `ChangeMe123!` | `SEED_ADMIN_PASSWORD` |
| Name | `Tabark Admin` | `SEED_ADMIN_NAME` |

The password is only written when the credential account does not exist yet, so
re-running the seed never resets an existing admin password. **Change the
default password immediately in any shared environment.**

The seed also creates the permission catalog, five roles, categories,
collections, six products with variants and stock, shipping zones/methods two
sample coupons (`WELCOME10`, `FREESHIP`) and public site settings.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development`, `test` or `production` |
| `PORT` | No | API port, default `4000` |
| `API_PREFIX` | No | Nest route prefix, default `api/v1` |
| `FRONTEND_URL` | Yes | Storefront URL used in emails and CORS |
| `TRUSTED_ORIGINS` | No | Comma-separated extra allowed origins |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Session signing secret (32+ chars) |
| `BETTER_AUTH_URL` | Yes | Public API URL, e.g. `https://api.tabark.com` |
| `SMTP_HOST` | No | SMTP host; email is disabled when empty |
| `SMTP_PORT` | No | SMTP port, default `587` |
| `SMTP_SECURE` | No | `true` for implicit TLS (usually port 465) |
| `SMTP_USER` / `SMTP_PASS` | No | SMTP credentials |
| `EMAIL_FROM` | No | Sender name and address |
| `UPLOAD_DIR` | No | Local upload directory, default `uploads` |
| `MAX_FILE_SIZE` | No | Upload size limit in bytes, default 5 MB |
| `SEED_ADMIN_EMAIL` | No | Seeded admin email |
| `SEED_ADMIN_PASSWORD` | No | Seeded admin password |
| `SEED_ADMIN_NAME` | No | Seeded admin display name |

Environment variables are validated at boot. The process fails fast with a
readable error when required values are missing or invalid.

## API conventions

- Storefront and admin REST API: `/api/v1/*`
- Better Auth: `/api/auth/*`
- Uploaded files: `/uploads/*`

Successful response:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully"
}
```

Paginated response adds `meta`:

```json
{
  "success": true,
  "data": [],
  "message": "Request completed successfully",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Error response:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid request",
  "error": "Bad Request"
}
```

### Authentication

Better Auth session cookies are the single source of truth. Protected requests
must send the session cookie:

```bash
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"admin@tabark.local","password":"ChangeMe123!"}' \
  http://localhost:4000/api/auth/sign-in/email

curl -b cookies.txt http://localhost:4000/api/v1/admin/dashboard
```

Better Auth endpoints include `sign-up/email`, `sign-in/email`, `sign-out`,
`get-session`, password reset and email verification. Email verification is
enforced only when SMTP is configured, so local development works without mail.

### Guest carts

Guest shopping requires a stable UUID per visitor in the `x-guest-id` header:

```bash
curl -H 'x-guest-id: 3f4c1a7e-2b5d-4a91-9b8e-0c1d2e3f4a5b' \
  http://localhost:4000/api/v1/cart
```

After login, `POST /api/v1/cart/merge` merges the guest cart into the customer
cart and marks the guest cart as converted.

## Endpoint overview

### Storefront

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/v1/health` |
| Products | `GET /api/v1/products`, `/featured`, `/new-arrivals`, `/best-sellers`, `/:slug` |
| Search | `GET /api/v1/search` |
| Categories | `GET /api/v1/categories`, `/:slug` |
| Collections | `GET /api/v1/collections`, `/:slug` |
| Settings | `GET /api/v1/settings` |
| Cart | `GET/DELETE /api/v1/cart`, `POST/PATCH/DELETE /api/v1/cart/items`, `POST /api/v1/cart/merge` |
| Wishlist | `GET/DELETE /api/v1/wishlist`, `POST/DELETE /api/v1/wishlist/items`, `POST /api/v1/wishlist/sync` |
| Customers | `GET/PATCH /api/v1/customers/me` |
| Addresses | `GET/POST /api/v1/addresses`, `PATCH/DELETE /api/v1/addresses/:id` |
| Shipping | `GET /api/v1/shipping/methods?country=US` |
| Coupons | `POST /api/v1/coupons/validate` |
| Checkout | `POST /api/v1/checkout/preview`, `POST /api/v1/checkout` |
| Orders | `GET /api/v1/orders`, `GET /api/v1/orders/:id`, `POST /api/v1/orders/:id/cancel` |
| Newsletter | `POST /api/v1/newsletter/subscribe`, `/confirm`, `/unsubscribe` |

Products support search, category/collection filters, price and availability
filters, sorting and pagination. Product prices are always recalculated on the
server.

### Administration

All admin routes require an active administrator session and the listed
permission.

| Area | Prefix |
| --- | --- |
| Dashboard | `/api/v1/admin/dashboard` |
| Products | `/api/v1/admin/products` |
| Categories | `/api/v1/admin/categories` |
| Collections | `/api/v1/admin/collections` |
| Inventory | `/api/v1/admin/inventory` |
| Orders | `/api/v1/admin/orders` |
| Customers | `/api/v1/admin/customers` |
| Coupons | `/api/v1/admin/coupons` |
| Shipping | `/api/v1/admin/shipping` |
| Uploads | `/api/v1/admin/uploads` |
| Newsletter | `/api/v1/admin/newsletter/subscribers` |
| Audit log | `/api/v1/admin/audit-logs` |
| Settings | `/api/v1/admin/settings` |

## Roles and permissions

The seed creates:

| Role | Scope |
| --- | --- |
| `super-admin` | Every permission; bypasses individual checks |
| `admin` | Full store administration |
| `product-manager` | Products, categories, collections, inventory, uploads |
| `order-manager` | Orders, shipping, customer read access, inventory read |
| `customer-support` | Orders and customer management without catalog access |

Permissions are defined in `src/common/constants/permissions.ts` and enforced by
`PermissionsGuard`. The frontend is never trusted for roles or permissions.

## Business rules

### Pricing and discounts

- Cart line prices and totals are calculated by the backend.
- Coupon validation covers active status, start/end dates, global usage limits,
  per-customer limits, minimum order amount, maximum discount and product,
  category or collection scopes.
- Percentage, fixed amount and free-shipping coupons are supported.
- Coupon usage is recorded transactionally with the order.

### Inventory

- Stock is tracked per variant.
- Checkout reserves stock with atomic conditional updates, preventing
  overselling under concurrency.
- Orders consume reserved stock when they move to `PROCESSING` or later.
- Cancelling an order before stock is consumed releases the reservation;
  cancelling after consumption restores stock and writes an inventory movement.
- Every manual or system stock change is recorded in `InventoryMovement`.

### Order statuses

```text
PENDING ──► AWAITING_PAYMENT ──► PROCESSING ──► PACKED ──► SHIPPED ──► DELIVERED
   │               │                  │            │
   └───────────────┴──────────────────┴────────────┴──► CANCELLED
```

Transitions are validated centrally. Customers may cancel only `PENDING` and
`AWAITING_PAYMENT` orders. Shipments store carrier, tracking number and shipment
status.

No payment gateway is integrated. Orders start as `UNPAID`; the payment status
must only change after a real, verified payment integration is added.

### Uploads

- Admin-only Multer uploads to `UPLOAD_DIR`.
- MIME type allow-list plus magic-byte content validation.
- Random UUID filenames; client filenames are never trusted.
- Maximum size and file count limits.
- Deletion validates the filename to prevent directory traversal.
- Files are served read-only from `/uploads/`.

`UPLOAD_DIR` must point to persistent storage in production. Do not deploy with
ephemeral disk if product images must survive restarts.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm start:dev` | Development server with watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm start:prod` | Run the compiled server |
| `pnpm lint` | ESLint + Prettier checks |
| `pnpm format` | Format source and tests |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | API integration tests |
| `pnpm prisma:generate` | Regenerate Prisma Client |
| `pnpm prisma:migrate` | Create/apply a development migration |
| `pnpm prisma:deploy` | Apply migrations in production |
| `pnpm prisma:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed permissions, roles, catalog and settings |

## Testing

```bash
pnpm test
DATABASE_URL=postgresql://... pnpm test:e2e
```

The unit suite covers coupon calculations and order status transitions. The e2e
suite exercises the real Nest application, database, response envelope, pagination,
authentication guard and guest-cart requirements against a running PostgreSQL
database. Better Auth's ESM runtime is stubbed in e2e tests; authentication is
verified separately by the live smoke test and Better Auth itself.

Use a dedicated test database. The e2e suite only reads seeded catalog data and
does not mutate it.

## Production deployment

1. Provision PostgreSQL and persistent disk storage.
2. Set `NODE_ENV=production` and strong secrets.
3. Run `pnpm install --frozen-lockfile && pnpm build`.
4. Run `pnpm prisma:deploy` before starting the process.
5. Run `pnpm db:seed` once (or manage roles/settings through the admin API).
6. Start with `pnpm start:prod` behind HTTPS.
7. Serve `/uploads` from the same persistent volume.
8. Monitor `/api/v1/health` and platform logs.
9. Back up PostgreSQL and uploaded files regularly.

Better Auth cookies are `httpOnly`, `sameSite=lax` and `secure` in production.
Set `BETTER_AUTH_URL` and `FRONTEND_URL` to the public HTTPS URLs and add the
storefront origin to `TRUSTED_ORIGINS`.

## Project structure

```text
src/
├── main.ts                 # bootstrap, Better Auth mount, security, static files
├── app.module.ts
├── admin/                  # dashboard, customers, settings
├── audit/                  # administrative audit log
├── auth/                   # Better Auth factory, guards, permissions
├── cart/                   # guest + customer carts
├── categories/
├── checkout/               # preview and transactional order creation
├── collections/
├── common/                 # decorators, guards, filters, interceptors, utils
├── config/                 # configuration + environment validation
├── coupons/
├── customers/
├── database/               # Prisma module/service
├── email/                  # Nodemailer service and templates
├── inventory/
├── newsletter/
├── orders/
├── products/
├── shipping/
├── uploads/
├── wishlist/
└── addresses/

prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```
