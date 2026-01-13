# Company Site - E-Commerce Platform

A full-stack e-commerce platform built with Next.js 16, featuring product management, shopping cart, Stripe payments, and passwordless authentication.

## Tech Stack

- **Framework**: Next.js 16.1.1 with React 19 and TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with magic link emails (Resend)
- **Payments**: Stripe Checkout
- **Styling**: Tailwind CSS v4

## Features

### Shopping Experience
- Product catalog with browsing
- Shopping cart with localStorage persistence (works for guests)
- Add to cart functionality with quantity management
- Cart icon with item count badge in header

### Checkout
- Full checkout flow with shipping address collection
- Guest checkout (no account required)
- Option to create account during checkout
- Pre-filled address for logged-in users
- Stripe-powered secure payment

### User Account
- Passwordless email authentication (magic links)
- Profile management (name, phone, shipping address)
- Order history and tracking
- Account dashboard

### Admin Dashboard
- Product management (CRUD, active/inactive toggle)
- Order management with status updates
- User management and role assignment
- View shipping addresses on orders

## Project Structure

```
company-site/
├── src/
│   ├── app/
│   │   ├── (auth pages)        # Sign-in, verify, error
│   │   ├── account/            # User account & orders
│   │   ├── admin/              # Admin dashboard
│   │   ├── api/                # API routes
│   │   ├── cart/               # Shopping cart page
│   │   ├── checkout/           # Checkout flow & results
│   │   ├── components/
│   │   │   ├── account/        # Profile form
│   │   │   ├── auth/           # Auth components
│   │   │   └── cart/           # Cart context & UI
│   │   └── products/           # Product catalog
│   └── lib/                    # Utilities (auth, db, stripe)
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Seed data
└── public/                     # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Stripe account
- Resend account (for emails)

### Installation

1. Clone the repository and install dependencies:

```bash
cd company-site
npm install
```

2. Copy the environment file and configure:

```bash
cp .env.example .env
```

3. Configure your `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/company_site?schema=public"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# App
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Auth (NextAuth.js)
AUTH_SECRET="<generate with: openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"

# Email (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM="onboarding@resend.dev"
```

4. Set up the database:

```bash
npm run db:migrate
npm run db:seed
```

5. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Stripe Webhooks (Development)

For local development, use the Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Database Commands

```bash
npm run db:migrate  # Run database migrations
npm run db:seed     # Seed sample data (3 products + admin user)
npm run db:studio   # Open Prisma Studio GUI
```

## Data Models

- **User**: Authentication, roles (USER/ADMIN), profile with shipping address
- **Product**: Name, description, price, image, active status
- **Order**: Status tracking, Stripe session, shipping address
- **OrderItem**: Line items with quantity and pricing

Order statuses: `PENDING` → `PAID` → `SHIPPED` → `DELIVERED` (or `CANCELLED`)

## User Flows

### Guest Checkout
1. Browse products and add to cart
2. Go to checkout, enter email and shipping address
3. Optionally check "Create an account"
4. Complete payment via Stripe
5. If account creation was selected, account is created with shipping info

### Registered User Checkout
1. Sign in via magic link
2. Browse products and add to cart
3. Go to checkout (address pre-filled from profile)
4. Complete payment via Stripe
5. View order in account dashboard

## Architecture Notes

- Server-side rendering for fast initial loads
- Layout-level route protection for `/admin` and `/account`
- Cart state managed via React Context with localStorage persistence
- Webhook-driven order updates from Stripe
- Guest orders automatically linked to accounts on registration
- Prices stored in cents for accuracy

## Deployment

The app is ready for deployment on Vercel or any platform supporting Next.js. Ensure all environment variables are configured in your deployment environment.

## License

MIT
