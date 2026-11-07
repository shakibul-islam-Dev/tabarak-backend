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
| Uploads | Multer (local disk or Vercel Blob) |
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
| `AUTH_COOKIE_SAME_SITE` | No | `lax` (default), `strict` or `none` for cross-site frontends |
| `SMTP_HOST` | No | SMTP host; email is disabled when empty |
| `SMTP_PORT` | No | SMTP port, default `587` |
| `SMTP_SECURE` | No | `true` for implicit TLS (usually port 465) |
| `SMTP_USER` / `SMTP_PASS` | No | SMTP credentials |
| `EMAIL_FROM` | No | Sender name and address |
| `UPLOAD_DRIVER` | No | `local` (default) or `vercel-blob` |
| `UPLOAD_DIR` | No | Local upload directory, default `uploads` (or `/tmp/tabark-uploads` on Vercel) |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob token; injected automatically by Vercel |
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
| Account | `GET/PATCH /api/v1/me` (alias: `/api/v1/customers/me`) |
| Addresses | `GET/POST /api/v1/addresses`, `PATCH/DELETE /api/v1/addresses/:id` |
| Shipping | `GET /api/v1/shipping/methods?country=US` |
| Coupons | `POST /api/v1/coupons/validate` |
| Checkout | `POST /api/v1/checkout/preview`, `POST /api/v1/checkout` |
| Orders | `GET /api/v1/orders`, `GET /api/v1/orders/my-orders`, `GET /api/v1/orders/:id`, `POST /api/v1/orders/:id/cancel` |
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
| Users | `/api/v1/admin/users` |
| Moderators | `/api/v1/admin/moderators` |
| Roles and permissions | `/api/v1/admin/roles`, `/api/v1/admin/permissions` |
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

### Moderator API

Moderators use a dedicated, permission-scoped surface. Every route requires an
active staff account and the permission listed in `src/common/constants/permissions.ts`.

| Area | Prefix |
| --- | --- |
| Dashboard | `/api/v1/moderator/dashboard` |
| Products | `/api/v1/moderator/products` |
| Orders | `/api/v1/moderator/orders` |

A moderator role never grants access to user management, roles, audit logs or
store settings. Assigning administrator roles is restricted to a super
administrator, and the last active administrator cannot be demoted or
deactivated.

## Roles and permissions

The seed creates:

| Role | Scope |
| --- | --- |
| `super-admin` | Every permission; bypasses individual checks |
| `admin` | Full store administration |
| `product-manager` | Products, categories, collections, inventory, uploads |
| `order-manager` | Orders, shipping, customer read access, inventory read |
| `customer-support` | Orders and customer management without catalog access |

The API exposes three account categories derived from staff membership:

| API role | Meaning |
| --- | --- |
| `ADMIN` | User with an active `super-admin` or `admin` staff profile |
| `MODERATOR` | User with any other active staff profile |
| `CUSTOMER` | User with no staff profile |

Customer registration always creates a `CUSTOMER`. Administrators create
moderator accounts with `POST /api/v1/admin/moderators` and change roles with
`PATCH /api/v1/admin/users/:id/role`.

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

- Admin-only Multer uploads.
- MIME type allow-list plus magic-byte content validation.
- Random UUID filenames; client filenames are never trusted.
- Maximum size and file count limits.
- Deletion validates the filename to prevent directory traversal.
- Local mode writes to `UPLOAD_DIR` and serves files read-only from `/uploads/`.
- `UPLOAD_DRIVER=vercel-blob` sends images to Vercel Blob and returns the public
  Blob URL instead.

`UPLOAD_DIR` must point to persistent storage in production. Vercel Functions
have a read-only filesystem apart from the ephemeral `/tmp`, so durable uploads
on Vercel require a connected Blob store and `UPLOAD_DRIVER=vercel-blob`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm start:dev` | Development server with watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm vercel-build` | Generate Prisma Client and compile for Vercel |
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

1. Provision PostgreSQL (with a pooled connection URL for serverless hosts).
2. Set `NODE_ENV=production` and strong secrets.
3. Run `pnpm install --frozen-lockfile && pnpm vercel-build` (or `pnpm build`).
4. Apply migrations with `pnpm prisma:deploy` before the new version receives traffic.
5. Run `pnpm db:seed` once (or manage roles/settings through the admin API).
6. Start with `pnpm start:prod` behind HTTPS, or deploy to Vercel as below.
7. Serve `/uploads` from persistent storage, or use Vercel Blob.
8. Monitor `/api/v1/health` and platform logs.
9. Back up PostgreSQL and uploaded files regularly.

Better Auth cookies are `httpOnly`, `secure` in production and `sameSite=lax`
by default. Set `BETTER_AUTH_URL` and `FRONTEND_URL` to the public HTTPS URLs and
add the storefront origin to `TRUSTED_ORIGINS`. If the frontend and API are on
different sites (including two separate `*.vercel.app` domains), set
`AUTH_COOKIE_SAME_SITE=none` so the browser sends the session cookie.

### Vercel

This repository is configured for Vercel's zero-configuration NestJS runtime:
Vercel detects `src/main.ts`, turns the whole app into one Function, and routes
every request through Nest. `vercel.json` runs `pnpm vercel-build`, which
generates Prisma Client (with the Amazon Linux engine) before compiling.

1. **Create the database.** Use Neon, Supabase, Vercel Postgres or another
   managed PostgreSQL. Copy the **pooled** connection string. For Supabase add
   `?pgbouncer=true&connection_limit=1`; for Neon use the `-pooler` host.
2. **Import the project** at [vercel.com/new](https://vercel.com/new) or run
   `pnpm dlx vercel` from the repository root. The framework is detected as
   NestJS; keep the default build settings.
3. **Add environment variables** in Project → Settings → Environment Variables.
   Required for every environment:

   ```env
   NODE_ENV=production
   DATABASE_URL=postgresql://...pooled...
   BETTER_AUTH_SECRET=<openssl rand -hex 32>
   BETTER_AUTH_URL=https://api.your-domain.com
   FRONTEND_URL=https://www.your-domain.com
   TRUSTED_ORIGINS=https://www.your-domain.com
   AUTH_COOKIE_SAME_SITE=none   # only when frontend and API are different sites
   ```

   Optional: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
   `EMAIL_FROM`, `MAX_FILE_SIZE`.
4. **Create a Vercel Blob store** (Project → Storage → Blob) and connect it to
   the project. Vercel injects `BLOB_READ_WRITE_TOKEN`; with the token present
   the app automatically uses `UPLOAD_DRIVER=vercel-blob`, so product images
   survive cold starts. Without Blob, uploads fall back to `/tmp` and are
   temporary.
5. **Apply migrations before the first request.** From a machine with the
   production `DATABASE_URL`:

   ```bash
   DATABASE_URL="postgresql://...pooled..." pnpm prisma:deploy
   DATABASE_URL="postgresql://...pooled..." pnpm db:seed   # first deploy only
   ```

   Keep migrations out of the build step so preview deployments cannot mutate
   the production database unexpectedly.
6. **Deploy** with `pnpm dlx vercel --prod`, or push to the connected Git
   branch. Verify:

   ```bash
   curl https://api.your-domain.com/api/v1/health
   ```

   Better Auth endpoints live under `https://api.your-domain.com/api/auth/*`.

Notes specific to serverless:

- The in-memory Throttler and Better Auth rate limits apply per warm function
  instance, not globally. For distributed limits, enforce them at the edge or in
  the database.
- Long-running background work, in-process cron jobs and persistent local files
  are not available. Use Vercel Cron Jobs for scheduled HTTP endpoints.
- Keep the function bundle below 250 MB. `prisma generate` only ships the
  engines listed in `binaryTargets`.
- Set the production domain (not a preview URL) as `BETTER_AUTH_URL`; previews
  can use their own `VERCEL_URL` only when `BETTER_AUTH_URL` is unset.


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
├── moderator/              # permission-scoped moderator API
├── newsletter/
├── orders/
├── products/
├── shipping/
├── uploads/
├── users/                  # admin user, moderator and role management
├── wishlist/
└── addresses/

prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```
