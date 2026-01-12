# Company Site - E-Commerce Platform

A full-stack e-commerce platform built with Next.js 16, featuring product management, Stripe payments, and passwordless authentication.

## Tech Stack

- **Framework**: Next.js 16.1.1 with React 19 and TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with magic link emails (Resend)
- **Payments**: Stripe Checkout
- **Styling**: Tailwind CSS v4

## Features

### Public
- Product catalog with browsing and purchasing
- Guest checkout support
- Stripe-powered payment flow

### User Account
- Passwordless email authentication (magic links)
- Order history and tracking
- Account dashboard

### Admin Dashboard
- Product management (CRUD, active/inactive toggle)
- Order management with status updates
- User management and role assignment

## Project Structure

```
company-site/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth pages)        # Sign-in, verify, error
│   │   ├── account/            # User account & orders
│   │   ├── admin/              # Admin dashboard
│   │   ├── api/                # API routes
│   │   ├── checkout/           # Success/cancelled pages
│   │   ├── components/         # React components
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

- **User**: Authentication, roles (USER/ADMIN)
- **Product**: Name, description, price, image, active status
- **Order**: Status tracking, Stripe session linking
- **OrderItem**: Line items with quantity and pricing

Order statuses: `PENDING` → `PAID` → `SHIPPED` → `DELIVERED` (or `CANCELLED`)

## Architecture Notes

- Server-side rendering for fast initial loads
- Middleware-based route protection for `/admin` and `/account`
- Webhook-driven order updates from Stripe
- Guest orders automatically linked to accounts on registration
- Prices stored in cents for accuracy

## Deployment

The app is ready for deployment on Vercel or any platform supporting Next.js. Ensure all environment variables are configured in your deployment environment.

## License

MIT
