# TABARK — UPDATED BACKEND DEVELOPMENT CONTEXT

## 1. Project Overview

**Project Name:** Tabark  
**Project Type:** Modern Minimalist E-commerce Startup  
**Backend Framework:** NestJS  
**Architecture:** Modular Monolith  
**API Style:** REST API  
**Language:** TypeScript  
**Database:** PostgreSQL

Build a secure, maintainable, and fully functional backend that integrates directly with the Tabark Next.js frontend.

The backend must support product management, categories, collections, inventory, shopping carts, wishlists, checkout preparation, orders, customer accounts, administration, and email notifications.

Keep the architecture simple and avoid unnecessary infrastructure.

---

## 2. Updated Technology Stack

Use the following technologies:

| Technology | Purpose |
|---|---|
| NestJS | Backend framework |
| TypeScript | Programming language |
| PostgreSQL | Primary database |
| Prisma ORM | Database management |
| Better Auth | Authentication and sessions |
| Multer | File upload handling |
| Nodemailer | Email delivery |
| class-validator | Request validation |
| class-transformer | Data transformation |
| Helmet | HTTP security headers |
| NestJS Throttler | Rate limiting |
| Jest | Unit testing |
| Supertest | API integration testing |
| ESLint + Prettier | Code quality and formatting |

### Explicitly Excluded Technologies

Do not introduce the following into the initial backend implementation:

- Redis.
- BullMQ.
- Swagger.
- OpenAPI.
- Pino.
- S3.
- Cloudinary.
- Payment gateway integrations.
- Docker.
- Microservices architecture.

Do not add these dependencies unless explicitly requested in a future development phase.

---

## 3. Backend Architecture

Use a modular monolith architecture with NestJS.

Architecture principles:

- Modular feature separation.
- RESTful API design.
- Strict TypeScript typing.
- Separation of controllers and services.
- Reusable providers.
- Dependency injection.
- Centralized exception handling.
- DTO-based request validation.
- Secure database operations.
- Maintainable code structure.

Avoid unnecessary abstractions and infrastructure.

---

## 4. Authentication — Better Auth

Use Better Auth as the primary authentication and session management solution.

Support:

- Customer registration.
- Email and password login.
- Logout.
- Email verification.
- Password reset.
- Session management.
- Account management.
- Google authentication as an optional future feature.

### NestJS Integration

- Integrate Better Auth with the NestJS application.
- Use its supported server handler integration.
- Expose authentication routes under `/api/auth/*`.
- Use Better Auth's PostgreSQL-compatible adapter.
- Implement session verification for protected NestJS routes.
- Create reusable authentication guards.
- Implement role-based authorization separately.
- Configure trusted origins and secure cookies.

Better Auth must remain the single source of truth for authentication and sessions.

Do not implement a competing custom JWT authentication system.

---

## 5. Database — PostgreSQL + Prisma

Use PostgreSQL as the primary database and Prisma ORM for database access.

Implement:
- Database migrations.
- Seed scripts.
- Relational models.
- Foreign-key relationships.
- Unique constraints.
- Database indexes.
- Transaction support.
- Type-safe queries.

### Core Database Models

**Authentication**
- User.
- Session.
- Account.
- Verification.

Use Better Auth's required schema for authentication-related tables.

**Customers**
- CustomerProfile.
- CustomerAddress.
- Wishlist.
- WishlistItem.

**Products**
- Product.
- ProductImage.
- ProductVariant.
- Category.
- ProductCategory.
- Collection.
- CollectionProduct.
- ProductAttribute.

**Inventory**
- Inventory.
- InventoryMovement.
- StockReservation.

**Shopping**
- Cart.
- CartItem.
- Coupon.
- Discount.

**Orders**
- Order.
- OrderItem.
- OrderAddress.
- OrderStatusHistory.

**Administration**
- AdminProfile.
- Role.
- Permission.
- AuditLog.

Design relationships carefully and preserve historical order information.

---

## 6. Product Management

Implement a complete product management system.

Features:
- Create products.
- Update products.
- Delete or archive products.
- Publish and unpublish products.
- Manage product descriptions.
- Manage product images.
- Manage pricing.
- Manage product variants.
- Manage categories.
- Manage collections.
- Manage availability.
- Manage featured products.

### Product Variants

Support:
- Size.
- Color.
- Material.
- Style.
- Other configurable attributes.

Each variant should support:
- Unique SKU.
- Price.
- Optional compare-at price.
- Stock quantity.
- Availability status.
- Variant-specific images.

### Product APIs

Support:
- All published products.
- Featured products.
- New arrivals.
- Best sellers.
- Products by category.
- Products by collection.
- Product search.
- Price filtering.
- Availability filtering.
- Sorting.
- Pagination.

Use PostgreSQL search capabilities initially.

---

## 7. Category & Collection Management

Features:
- Create, update, and delete categories.
- Nested categories where appropriate.
- Category images.
- Category descriptions.
- Collection creation.
- Collection management.
- Manual product assignment.
- Featured collections.
- Collection publishing status.

All collection and category information must be dynamically retrieved by the frontend.

---

## 8. Inventory Management

Implement reliable inventory tracking.

Features:
- Variant-level stock.
- Stock quantity updates.
- Inventory movement history.
- Low-stock detection.
- Out-of-stock detection.
- Stock reservation during checkout.
- Reservation expiration.
- Inventory restoration after eligible cancellations.

### Inventory Rules

- Never trust client-submitted stock quantities.
- Verify stock on the server.
- Prevent overselling.
- Use database transactions.
- Handle concurrent checkout requests safely.
- Maintain inventory history.

---

## 9. Shopping Cart

Implement a persistent shopping cart.

Features:
- Add items.
- Remove items.
- Update quantities.
- Retrieve cart.
- Clear cart.
- Calculate subtotal.
- Apply discounts.
- Validate product availability.
- Validate product variants.

### Guest Cart

Allow visitors to shop without registration.

Support:
- Guest cart identifiers.
- Persistent guest carts.
- Cart retrieval.
- Guest-to-customer cart merging after login.

The backend must calculate all product prices and cart totals.

Never trust frontend-submitted prices.

---

## 10. Wishlist

Implement:
- Add products to wishlist.
- Remove products.
- Retrieve wishlist.
- Prevent duplicate entries.
- Synchronize authenticated customer wishlists.

Guest wishlist functionality can be managed locally and synchronized after login.

---

## 11. Checkout & Order Management

Implement a checkout preparation and order management system.

### Checkout Flow

1. Customer reviews the cart.
2. Backend validates products.
3. Backend verifies variants and inventory.
4. Customer selects a shipping address.
5. Backend calculates shipping charges.
6. Customer applies a coupon if available.
7. Backend recalculates the order total.
8. Backend creates an order with an appropriate pending or awaiting-payment status.
9. Order information is stored.
10. Customer can view order details and status.

**Important:** Do not implement payment gateway integrations at this stage.

The order architecture should remain ready for future payment integration without implementing payment processing now.

Do not mark orders as paid without a verified payment process.

### Order Statuses

- Pending.
- Awaiting Payment.
- Processing.
- Packed.
- Shipped.
- Delivered.
- Cancelled.

Keep order status transitions controlled and maintain a complete status history.

### Customer Order Features

- View orders.
- View order details.
- View purchased products.
- View order status.
- View shipping information.
- Access order history.

### Admin Order Features

- View orders.
- Search and filter orders.
- Update order status.
- View customer details.
- Manage shipping information.
- Cancel eligible orders.

---

## 12. Shipping Management

Implement basic shipping configuration.

Features:
- Shipping zones.
- Shipping methods.
- Shipping prices.
- Free shipping rules.
- Delivery estimates.
- Address management.
- Shipment information.
- Tracking number storage.

Keep shipping calculations on the backend.

External courier integrations can be added later.

---

## 13. Coupon & Discount Management

Support:
- Percentage discounts.
- Fixed-amount discounts.
- Minimum order amount.
- Maximum discount amount.
- Expiration dates.
- Usage limits.
- Per-customer limits.
- Product-specific discounts.
- Collection-specific discounts.
- Free shipping discounts.
- Active/inactive status.

All discount validation and calculations must happen server-side.

---

## 14. File Upload Management — Multer

Use Multer for handling file uploads within NestJS.

Do not implement S3 or Cloudinary storage in the current version.

### Upload Features

- Product image uploads.
- Multiple product images.
- Variant images.
- Collection images.
- Promotional banners.
- Image replacement.
- Image deletion.

### Upload Implementation

- Use NestJS `FileInterceptor` and `FilesInterceptor`.
- Validate image MIME types.
- Restrict file sizes.
- Generate unique filenames.
- Prevent unsafe file uploads.
- Store uploaded files in a controlled local upload directory.
- Save file paths and metadata in PostgreSQL.
- Serve uploaded images through properly configured static file routes.

### File Security

- Never trust filenames provided by clients.
- Never allow arbitrary file extensions.
- Validate actual file content where appropriate.
- Restrict upload permissions to authorized users.
- Prevent directory traversal.
- Do not allow executable file uploads.
- Configure safe file access.

Keep the storage service modular so cloud storage can be introduced later without rewriting product management.

Note: Local file storage requires persistent disk storage in production. Do not use temporary or ephemeral deployment storage for permanent product images.

---

## 15. Email System — Nodemailer

Use Nodemailer for email delivery.

Do not introduce Resend or another email delivery SDK in the initial version.

### Email Features

- Welcome emails.
- Email verification.
- Password reset.
- Order confirmation.
- Order status updates.
- Shipping notifications.
- Newsletter notifications.

### Implementation

- Create a reusable EmailModule.
- Create an EmailService.
- Configure SMTP through environment variables.
- Use reusable HTML email templates.
- Keep email credentials private.
- Handle SMTP errors.
- Avoid blocking critical API responses unnecessarily.

Use asynchronous email sending where appropriate without introducing BullMQ or Redis.

For important email operations, record the result and allow controlled retries.

---

## 16. Customer Management

Implement:
- Customer profiles.
- Customer addresses.
- Customer order history.
- Customer search.
- Customer account status.
- Customer support information.

Protect customer information through proper authentication and authorization.

Admin access must be permission-controlled.

---

## 17. Administration & Role-Based Access Control

Create a secure administration system.

### Roles

- Super Admin.
- Admin.
- Product Manager.
- Order Manager.
- Customer Support.

### Admin Features

- Dashboard data.
- Product management.
- Category management.
- Collection management.
- Inventory management.
- Order management.
- Customer management.
- Coupon management.
- Website content management.

Implement NestJS guards and permission decorators.

Never rely on frontend restrictions for administrative security.

---

## 18. REST API Structure

Use versioned REST endpoints.

Base API:

`/api/v1`

Authentication:

`/api/auth/*`

### Customer API Endpoints

| Module | Endpoint |
|---|---|
| Products | `/api/v1/products` |
| Product details | `/api/v1/products/:slug` |
| Categories | `/api/v1/categories` |
| Collections | `/api/v1/collections` |
| Search | `/api/v1/search` |
| Cart | `/api/v1/cart` |
| Wishlist | `/api/v1/wishlist` |
| Checkout | `/api/v1/checkout` |
| Orders | `/api/v1/orders` |
| Addresses | `/api/v1/addresses` |
| Customer profile | `/api/v1/customers/me` |
| Coupon validation | `/api/v1/coupons/validate` |
| Newsletter | `/api/v1/newsletter/subscribe` |

### Admin API Endpoints

Prefix:

`/api/v1/admin/*`

Include:
- Dashboard.
- Products.
- Categories.
- Collections.
- Inventory.
- Orders.
- Customers.
- Coupons.
- Settings.

All administrative endpoints must be protected.

### Response Format

Use a consistent response format.

Successful response:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully"
}
```

Error response:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid request",
  "error": "VALIDATION_ERROR"
}
```

Use consistent pagination metadata.

Do not expose internal database errors or stack traces in production.

---

## 19. Frontend & Backend Integration

The Next.js frontend and NestJS backend must communicate through a consistent API contract.

### Integration Rules

- Use a centralized API client in Next.js.
- Keep the API base URL in environment variables.
- Use shared TypeScript types where practical.
- Maintain consistent response structures.
- Implement loading and error states.
- Handle expired sessions.
- Handle network failures.
- Avoid duplicating business logic.
- Keep all sensitive operations on the backend.

### Authentication Integration

Configure:
- Better Auth trusted origins.
- Secure cookie handling.
- Credentialed CORS.
- Correct cookie domain.
- HTTPS in production.
- Appropriate SameSite settings.
- Session verification.

Do not expose privileged backend credentials to browser code.

### API Responsibilities

The frontend handles:
- Displaying data.
- User interactions.
- Form input.
- Visual state.
- Client-side validation for usability.

The backend handles:
- Authentication.
- Authorization.
- Product pricing.
- Inventory.
- Cart calculations.
- Coupon validation.
- Checkout.
- Order creation.
- Business rules.
- Data persistence.

The backend must always remain the source of truth for business-critical information.

---

## 20. Recommended Backend Folder Structure

```text
src/
├── main.ts
├── app.module.ts
│
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   └── constants/
│
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── auth.config.ts
│   └── mail.config.ts
│
├── database/
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── auth/
├── users/
├── customers/
├── products/
├── categories/
├── collections/
├── inventory/
├── cart/
├── wishlist/
├── checkout/
├── orders/
├── shipping/
├── coupons/
├── uploads/
├── newsletter/
├── notifications/
├── email/
├── admin/
└── audit/
```

Each module should contain its own controllers, services, DTOs, and related logic.

---

## 21. Environment Configuration

Use environment variables for secrets and configuration.

Example:

```env
NODE_ENV=development
PORT=4000
API_PREFIX=api/v1

FRONTEND_URL=http://localhost:3000

DATABASE_URL=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:4000

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

TRUSTED_ORIGINS=http://localhost:3000
```

These are placeholders, not actual credentials.

Requirements:
- Validate environment variables at startup.
- Never commit real secrets.
- Provide `.env.example`.
- Separate development and production settings.
- Use secure SMTP settings in production.
- Ensure upload directories have persistent storage.

---

## 22. Security Requirements

Implement:
- Helmet.
- Strict CORS.
- Rate limiting.
- Input validation.
- Better Auth session verification.
- Role-based authorization.
- Secure cookies.
- File upload validation.
- Request size limits.
- Environment-based secrets.
- Audit logging.
- Safe error handling.

Critical rules:

1. Never expose database credentials.
2. Never expose authentication secrets.
3. Never trust frontend prices.
4. Never trust frontend roles.
5. Never expose private customer data.
6. Never allow unrestricted admin operations.
7. Never accept arbitrary file uploads.
8. Never expose sensitive information in logs.
9. Validate every incoming request.
10. Protect all customer-owned resources.

---

## 23. Testing Strategy

Use Jest and Supertest.

### Unit Tests

Test:
- Authentication guards.
- Product services.
- Price calculations.
- Discount calculations.
- Inventory operations.
- Cart services.
- Order state transitions.
- Permission checks.

### Integration Tests

Test:
- Prisma database operations.
- Better Auth integration.
- Cart synchronization.
- Checkout.
- Order creation.
- File uploads.
- Email service.
- Inventory reservations.

### End-to-End Tests

Test the complete customer journey:

1. Register.
2. Log in.
3. Browse products.
4. Search products.
5. Add to cart.
6. Update quantities.
7. Apply a coupon.
8. Submit checkout.
9. Create an order.
10. Retrieve order details.
11. Track order status.

Also test administrative operations.

Use a separate test database and mock external services where appropriate.

---

## 24. Deployment Requirements

Prepare the backend for production deployment without Docker.

Requirements:
- Production build configuration.
- Environment variable validation.
- Database migration strategy.
- Persistent database hosting.
- Persistent file storage.
- HTTPS.
- Secure cookies.
- Graceful shutdown.
- Health check endpoint.
- Structured error handling.
- Database backups.
- Application monitoring through deployment-platform logs.

Do not depend on temporary deployment storage for product images.

Keep the deployment process simple and compatible with standard Node.js hosting platforms.

---

## 25. Development Phases

Implement the backend in the following order.

**Phase 1 — Foundation**
- Initialize NestJS.
- Configure PostgreSQL.
- Integrate Prisma.
- Configure environment variables.
- Set up global validation.
- Configure security middleware.
- Establish API structure.

**Phase 2 — Authentication**
- Integrate Better Auth.
- Configure session handling.
- Implement authentication guards.
- Implement customer authorization.
- Implement admin roles.

**Phase 3 — Product System**
- Products.
- Variants.
- Categories.
- Collections.
- Product images.
- Search and filtering.

**Phase 4 — Shopping**
- Cart.
- Guest cart.
- Cart synchronization.
- Wishlist.
- Pricing calculations.

**Phase 5 — Orders**
- Checkout validation.
- Inventory reservations.
- Order creation.
- Order history.
- Order management.

**Phase 6 — Administration**
- Dashboard.
- Product management.
- Inventory management.
- Order management.
- Customer management.
- Coupon management.

**Phase 7 — Supporting Services**
- Multer uploads.
- Nodemailer.
- Newsletter.
- Shipping configuration.
- Audit logging.

**Phase 8 — Testing & Deployment**
- Unit testing.
- Integration testing.
- E2E testing.
- Security review.
- Performance optimization.
- Production deployment.

---

## 26. Final Development Instructions

Build Tabark's backend as a secure, modular, maintainable, and production-ready e-commerce API.

### Non-Negotiable Requirements

1. NestJS with TypeScript.
2. Better Auth for authentication.
3. PostgreSQL with Prisma ORM.
4. Multer for file uploads.
5. Nodemailer for email delivery.
6. Versioned REST APIs.
7. Strong request validation.
8. Secure role-based authorization.
9. Reliable inventory and order management.
10. Backend-driven pricing and business logic.
11. Consistent Next.js integration.
12. Comprehensive testing.
13. Production-ready configuration.
14. No unnecessary infrastructure.

### Final Quality Standard

The backend must be:

- Secure.
- Reliable.
- Maintainable.
- Type-safe.
- Efficient.
- Modular.
- Easy to integrate.
- Ready for future expansion.

**FINAL PRINCIPLE**

KEEP THE ARCHITECTURE SIMPLE.

KEEP BUSINESS LOGIC CENTRALIZED.

KEEP CUSTOMER DATA SECURE.

KEEP THE API CONSISTENT.

BUILD ONLY WHAT TABARK NEEDS RIGHT NOW.