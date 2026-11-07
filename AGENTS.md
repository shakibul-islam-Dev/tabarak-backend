# tabarak — Backend Engineering Context

## 1. Project Overview

Build the backend for **tabarak**, a minimalist, premium e-commerce website, using a secure, maintainable, and scalable architecture.

The backend must support three distinct user roles:

1. **Customer**
2. **Moderator**
3. **Admin**

Use a modular monolith architecture with NestJS and TypeScript. Prioritize clean code, database integrity, security, maintainability, and well-structured business logic.

## 2. Technology Stack

- **Backend framework:** NestJS
- **Language:** TypeScript
- **Authentication:** Better Auth
- **Database:** PostgreSQL
- **ORM:** Prisma
- **File uploads:** Multer
- **File storage:** Local persistent storage
- **Email:** Nodemailer with SMTP
- **Validation:** class-validator and class-transformer
- **Security:** Helmet and NestJS Throttler
- **Testing:** Jest and Supertest
- **Code quality:** ESLint and Prettier

Do not introduce Redis, BullMQ, Swagger, OpenAPI, Pino, S3, Cloudinary, Resend, payment gateways, Docker, or microservices.

## 3. Database Engineering

Treat database design as a core engineering responsibility, not simply as creating tables for application features.

### Database design requirements

- Design a normalized relational database using PostgreSQL.
- Use Prisma schema definitions for models, relations, and constraints.
- Define primary keys, foreign keys, unique constraints, and appropriate indexes.
- Use explicit one-to-one, one-to-many, and many-to-many relationships where appropriate.
- Prevent orphaned records and invalid relationships.
- Use transactions for operations that modify multiple related records.
- Use database constraints to enforce important business rules.
- Avoid unnecessary duplication and inconsistent data.
- Use appropriate deletion strategies, such as restricted deletion, cascading deletion, or soft deletion, depending on the entity.
- Store timestamps such as `createdAt` and `updatedAt` consistently.
- Use decimal types for monetary values, never floating-point types.
- Store product prices and order item prices as snapshots where historical accuracy is required.
- Use Prisma migrations for every database schema change.
- Never modify the production database schema manually without a migration.
- Seed development data with realistic sample records.
- Keep database queries efficient and avoid N+1 query problems.
- Add pagination, filtering, and sorting at the database-query level.
- Use transactions for order creation, inventory updates, and other multi-step operations.

### Main database entities

Design the database around these entities:

- User
- Session
- Account
- Verification
- Role
- UserRole (only if a separate role-assignment model is needed)
- CustomerProfile
- Address
- Product
- ProductVariant
- ProductImage
- Category
- Collection
- Inventory
- Cart
- CartItem
- Wishlist
- WishlistItem
- Order
- OrderItem
- OrderStatusHistory
- Coupon
- ShippingMethod
- NewsletterSubscriber
- EmailLog
- AuditLog

Better Auth must own its authentication-related data structures. Follow its required schema and adapter conventions rather than inventing incompatible authentication tables.

Avoid duplicating authentication users in a separate application user table. Connect business-related records to the appropriate Better Auth user identity.

## 4. Three-Role Architecture and Authorization

Implement strict role-based access control (RBAC) across the entire backend.

The application has three roles with separate permissions and access boundaries.

### Role 1: Customer

Customers use the public website and customer account features.

**Permissions:**
- Browse products, categories, and collections.
- Search, filter, and sort products.
- View product details and variants.
- Manage their own profile.
- Manage their own shipping addresses.
- Add, update, and remove their own cart items.
- Manage their own wishlist.
- Create orders.
- View their own orders and order history.
- Subscribe to the newsletter.
- Access their own account information.

**Restrictions:**
- Cannot access the admin panel.
- Cannot access moderator routes.
- Cannot view other customers' private information.
- Cannot change their own role.
- Cannot modify product prices, stock, or store settings.
- Cannot change order status or mark orders as paid.

### Role 2: Moderator

Moderators manage day-to-day store operations through a dedicated moderator panel.

**Permissions:**
- Access moderator dashboard.
- View and manage product listings.
- Create, update, and organize products.
- Manage product images and variants.
- Manage categories and collections.
- View customer orders.
- Update permitted order statuses.
- View inventory and update stock when authorized.
- Manage coupons if granted the corresponding permission.
- Moderate customer-facing content where applicable.

**Restrictions:**
- Cannot access sensitive system settings.
- Cannot create, delete, or promote admins.
- Cannot assign or change user roles.
- Cannot modify administrator accounts.
- Cannot access unrestricted user-management functionality.
- Cannot change security-critical configuration.
- Cannot perform actions outside explicitly granted permissions.

### Role 3: Admin

Admins have full administrative control over the store.

**Permissions:**
- Access the complete admin panel.
- Manage all products, variants, images, categories, and collections.
- Manage inventory and stock.
- View and manage all orders.
- Manage order statuses.
- Manage customers and customer accounts.
- Create, update, deactivate, and manage moderator accounts.
- Assign and revoke moderator permissions.
- Manage roles and permissions.
- Manage coupons and shipping settings.
- View audit logs.
- Manage newsletter subscribers.
- Manage store settings.
- Access administrative reports and dashboard statistics.
- Perform all moderator operations.

**Restrictions and safeguards:**
- Protect critical admin actions with additional authorization checks.
- Do not allow ordinary customers or moderators to promote themselves.
- Protect the last active admin account from accidental removal or demotion.
- Log sensitive administrative actions.
- Require explicit confirmation for destructive operations.

### Role implementation

Use a centralized authorization system.

Recommended components:

- `RolesGuard`
- `PermissionsGuard`
- `@Roles()` decorator
- `@Permissions()` decorator
- Role and permission enums or database-backed permission records
- A centralized authorization service

Do not rely on frontend role checks for security. Every protected backend endpoint must independently verify authentication and authorization.

A role determines the user's access category. Permissions determine which individual operations that role can perform.

Use permission-based checks for sensitive moderator operations instead of giving moderators unrestricted admin access.

Never accept a user's role from a public registration request. New registrations must always receive the `CUSTOMER` role.

Admin and moderator accounts must be created or promoted through protected administrative procedures or secure initial setup.

## 5. Authentication and Sessions

Use Better Auth for:

- Registration
- Login
- Logout
- Session management
- Password hashing and verification
- Password reset
- Email verification
- Account management

Integrate Better Auth with NestJS using its supported integration approach.

Requirements:

- Secure HTTP-only cookies.
- Appropriate SameSite and Secure cookie settings.
- Session expiration and revocation.
- Email verification where required.
- Password reset through Nodemailer.
- Protected routes using authentication guards.
- Role and permission checks after authentication.
- Prevent privilege escalation.
- Validate session ownership and user status.

API base paths:

- Application API: `/api/v1`
- Better Auth endpoints: `/api/auth/*`

## 6. Backend Modules

Organize the application into independent NestJS modules.

### Core modules

- AuthModule
- UsersModule
- RolesModule
- PermissionsModule
- DatabaseModule
- UploadsModule
- EmailModule
- AuditModule

### E-commerce modules

- ProductsModule
- CategoriesModule
- CollectionsModule
- InventoryModule
- CartModule
- WishlistModule
- OrdersModule
- ShippingModule
- CouponsModule
- CustomersModule
- NewsletterModule

### Dashboard modules

- CustomerDashboardModule
- ModeratorDashboardModule
- AdminDashboardModule

Keep business logic inside services and keep controllers focused on HTTP requests and responses.

## 7. API Structure

Use REST APIs with consistent response formats.

Example route organization:

**Public routes**
- `GET /api/v1/products`
- `GET /api/v1/products/:slug`
- `GET /api/v1/categories`
- `GET /api/v1/collections`

**Customer routes**
- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `GET /api/v1/addresses`
- `POST /api/v1/addresses`
- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `GET /api/v1/wishlist`
- `POST /api/v1/orders`
- `GET /api/v1/orders/my-orders`

**Moderator routes**
- `GET /api/v1/moderator/dashboard`
- `GET /api/v1/moderator/products`
- `POST /api/v1/moderator/products`
- `PATCH /api/v1/moderator/products/:id`
- `GET /api/v1/moderator/orders`
- `PATCH /api/v1/moderator/orders/:id/status`

**Admin routes**
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/moderators`
- `PATCH /api/v1/admin/users/:id/role`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/audit-logs`
- `PATCH /api/v1/admin/settings`

Every route must enforce the correct role and permission requirements.

## 8. File Uploads

Use Multer for handling uploads.

Requirements:

- Configure file size limits.
- Validate MIME types and file extensions.
- Generate unique file names.
- Prevent path traversal.
- Store uploaded files in a persistent local `uploads/` directory.
- Organize uploads into folders such as products, categories, and profiles.
- Provide controlled access to uploaded files where appropriate.
- Delete unused files safely.
- Keep file storage behind a dedicated service so cloud storage can be introduced later.

Multer handles uploads; it is not the storage system itself. Production hosting must provide persistent disk storage. Do not depend on temporary or ephemeral storage for product images.

## 9. Email System

Use Nodemailer with SMTP.

Email features:

- Account verification
- Password reset
- Order confirmation
- Order status updates
- Customer notifications
- Admin notifications where needed
- Newsletter-related emails

Keep email templates separate from business logic.

Use environment variables for SMTP credentials. Never expose SMTP credentials to the frontend.

## 10. Orders and Payments

Payment gateway integration is intentionally excluded for the current version.

Implement:

- Cart validation.
- Product and variant availability checks.
- Inventory validation.
- Order creation.
- Order item price snapshots.
- Shipping address snapshots.
- Order status management.
- Order history.
- Order confirmation emails.

Do not mark an order as paid without a verified payment process. Keep payment-related fields and future integration points structured so a payment provider can be added later.

## 11. Security

- Validate all incoming data.
- Use Helmet.
- Apply rate limiting with NestJS Throttler.
- Protect authentication and administrative endpoints.
- Enforce RBAC and permission checks server-side.
- Prevent SQL injection through safe Prisma usage.
- Prevent insecure direct object references by checking resource ownership.
- Protect against mass assignment.
- Restrict file uploads.
- Use secure cookies.
- Keep secrets in environment variables.
- Log important administrative and security events.
- Never expose passwords, tokens, or sensitive account information in API responses or logs.

## 12. Audit Logging

Maintain an audit trail for important actions.

Record:
- Actor user ID.
- Actor role.
- Action.
- Target entity and ID.
- Timestamp.
- Relevant metadata.
- Request context where appropriate.

Audit events should include:
- Role changes.
- Moderator creation or deactivation.
- Product creation and modification.
- Inventory changes.
- Order status changes.
- Sensitive customer account changes.
- Store setting changes.

Audit logs must be protected from unauthorized modification and access.

## 13. Environment Variables

Example `.env`:

```env
NODE_ENV=development
PORT=3001

DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/tabarak"

BETTER_AUTH_SECRET="replace-with-a-secure-secret"
BETTER_AUTH_URL="http://localhost:3001"

SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="tabarak <your-email@example.com>"

UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880

FRONTEND_URL="http://localhost:3000"
```

Never commit real secrets to version control.

## 14. Recommended Project Structure

```text
src/
├── auth/
├── users/
├── roles/
├── permissions/
├── database/
├── products/
├── categories/
├── collections/
├── inventory/
├── cart/
├── wishlist/
├── orders/
├── shipping/
├── coupons/
├── customers/
├── uploads/
├── email/
├── newsletter/
├── audit/
├── dashboards/
│   ├── customer/
│   ├── moderator/
│   └── admin/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── config/
├── app.module.ts
└── main.ts

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

uploads/
```

## 15. Testing Requirements

Use Jest and Supertest.

Test:
- Authentication and session handling.
- Customer registration and default role assignment.
- Role-based route protection.
- Permission-based moderator restrictions.
- Admin-only operations.
- Prevention of privilege escalation.
- Customer resource ownership.
- Database relationships and constraints.
- Product and inventory operations.
- Cart and order creation.
- Transaction rollback on failures.
- File upload validation.
- Email service behavior.
- Audit log creation.

Include negative authorization tests: customers must not access moderator or admin endpoints, and moderators must not access admin-only functionality.

## 16. Development Priorities

Build in this order:

1. NestJS project setup and configuration.
2. PostgreSQL and Prisma setup.
3. Database architecture, schema design, migrations, and seed data.
4. Better Auth integration.
5. Customer, moderator, and admin role architecture.
6. Authentication guards, role guards, and permission guards.
7. Product, category, and collection modules.
8. Inventory management.
9. Cart and wishlist.
10. Order management without payment integration.
11. Multer uploads.
12. Nodemailer email system.
13. Customer, moderator, and admin dashboards APIs.
14. Audit logging.
15. Security hardening and automated tests.

## 17. Engineering Standards

- Write clean, strongly typed TypeScript.
- Follow NestJS module architecture.
- Keep controllers thin and services focused.
- Keep database access organized and reusable.
- Use DTOs for request validation.
- Avoid unnecessary abstractions.
- Use database transactions for critical business operations.
- Use consistent error handling and HTTP status codes.
- Write tests for important business logic and permissions.
- Maintain a clear separation between customer, moderator, and admin capabilities.
- Design the database before implementing business modules.
- Prefer data integrity and security over shortcuts.

**Final goal:** Build a production-ready, secure, well-engineered e-commerce backend for tabarak, with a properly designed PostgreSQL database, Prisma ORM, Better Auth authentication, and three clearly separated user roles: Customer, Moderator, and Admin.