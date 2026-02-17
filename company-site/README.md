# BioGrammatics E-Commerce Platform

Next.js e-commerce platform for BioGrammatics, a biotechnology company specializing in Pichia pastoris expression vectors and strains.

**Production:** [beta.biogrammatics.com](https://beta.biogrammatics.com) (Render)

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components, Server Actions)
- **Database:** PostgreSQL (Render) with Prisma 7 ORM
- **Auth:** NextAuth v5 (magic link via email)
- **Payments:** Stripe (Checkout Sessions + Invoicing)
- **Shipping:** ShipStation V2 API (FedEx rate calculation)
- **Email:** Resend (transactional emails, quote delivery)
- **File Storage:** AWS S3 (vector files, images) with signed URLs
- **Deployment:** Render (web service + background worker)

## Current Features

### Public Site
- Vector catalog with thumbnail images and search/filtering
- Vector detail pages with specifications, images, and downloadable files (SnapGene, GenBank, FASTA)
- Pichia strain catalog
- Codon optimization tool (client-side + background worker for large jobs)
- Cookie and privacy policy pages

### Authentication
- Magic link login (passwordless via Resend)
- Role-based access: USER, ADMIN, SUPER_ADMIN
- Authorized email system for controlled registration

### Admin Panel
- Vector CRUD with thumbnail/image upload (400x400 WebP thumbnails in DB, full images in S3)
- Lot management with QC files
- File management with S3 upload/download
- User management

### File Storage (AWS S3)
- Secure file upload for vector files and lot QC documents
- Signed download URLs with original filenames
- Inline image viewing for vector maps on catalog/detail pages
- Public downloads for available products, auth-required for others

## Commerce Architecture (Building)

### Customer Journey

```
Browse Catalog --> Add to Cart --> Three Exit Paths:

1. "Checkout Now"    --> Stripe Checkout --> Credit card payment --> Order fulfilled
2. "Request Quote"   --> PDF generated & emailed (Resend) --> Quote saved to dashboard
3. "Request Invoice" --> (from dashboard) --> Enter PO# / AP email --> Stripe Invoice sent
```

### Payment Paths

**Direct Checkout (Stripe Checkout - redirect mode)**
- Customer pays immediately via Stripe's hosted payment page
- Supports credit/debit cards, Apple Pay, Google Pay
- Webhook confirms payment, order marked as PAID
- Replaces current WIX payment processing

**Quote Path (self-managed, no Stripe Quotes)**
- Customer builds cart, clicks "Request Quote"
- Server generates branded PDF quote with line items + shipping estimate
- Quote emailed to customer via Resend
- Quote saved to customer dashboard with 60-day expiration
- Tax and handling noted as "added at invoicing"
- Customer can later: convert to checkout, request invoice, modify, or delete

**Invoice Path (Stripe Invoicing Starter - 0.4%)**
- Customer converts a quote to invoice from their dashboard
- Can enter PO number and AP department email
- Stripe Invoice generated and emailed with hosted payment page
- Customer pays via: credit card, ACH bank transfer, or physical check
- Admin marks check payments as "paid out of band" in Stripe

### Customer Dashboard
- **Orders** - purchase history, order status
- **Quotes** - pending quotes with actions (checkout, request invoice, modify, delete)
- **Invoices** - outstanding and paid Stripe invoices

### Shipping (ShipStation V2 API)
- Origin: Carlsbad, CA (fixed)
- Package type: FedEx envelope (standard for vectors)
- FedEx service tiers: Ground, 2Day, Standard Overnight, Priority Overnight
- FedEx International for international orders
- Real-time rate calculation at cart/checkout
- Shipping estimate included in quotes; tax/handling added at invoicing
- Dry ice shipments: TBD (verifying current ShipStation/FedEx handling)

### Stripe Integration
- Every customer mapped 1:1 to a Stripe Customer
- `stripeCustomerId` on User model
- Checkout Sessions for pay-now (mode: "payment")
- Stripe Invoicing for invoice path (Starter tier, 0.4% per paid invoice)
- Webhook events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
- Subscription support for vector collection access (future)

## Environment Variables

```
# Database
DATABASE_URL=

# Auth
NEXTAUTH_URL=
NEXTAUTH_SECRET=
ADMIN_EMAIL=

# Email
RESEND_API_KEY=
EMAIL_FROM=

# Payments
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# File Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# Shipping
SHIPSTATION_API_KEY=
```

## Project Structure

```
company-site/
  prisma/
    schema.prisma          # Database schema
  src/
    app/
      admin/               # Admin panel (vectors, lots, files, users)
      api/                 # API routes (checkout, webhooks, files, shipping)
      account/             # Customer dashboard
      auth/                # Login/register pages
      cart/                # Shopping cart
      checkout/            # Checkout flow
      codon-optimization/  # Codon optimization tool
      vectors/             # Public vector catalog & detail pages
      strains/             # Public strain catalog
      products/            # Product pages
      components/          # Shared UI components
    lib/
      auth.ts              # NextAuth configuration
      db.ts                # Prisma client
      stripe.ts            # Stripe instance
      s3.ts                # AWS S3 utilities
      codon-optimization.ts # Codon optimization engine
  worker/
    codon-worker.ts        # Background worker for large optimization jobs
  render.yaml              # Render deployment config
```

## Development

```bash
npm install
npx prisma generate
npm run dev
```

For Stripe webhook testing locally:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Deployment

Deployed on Render via `render.yaml`:
- **Web service:** Next.js app (free tier)
- **Background worker:** Codon optimization worker (starter tier, $7/mo)
- **Database:** PostgreSQL (free tier)

Build command: `npm install && npx prisma generate && npx prisma db push --accept-data-loss && npm run build`

## To-Do

### High Priority
- [ ] Shopping cart (React context + localStorage)
- [ ] ShipStation V2 integration for FedEx rate calculation
- [ ] Stripe Checkout flow (pay now)
- [ ] Add stripeCustomerId to User model
- [ ] Quote system (PDF generation, email, dashboard management)
- [ ] Customer dashboard (orders, quotes, invoices)

### Medium Priority
- [ ] Stripe Invoicing integration (invoice path with PO support)
- [ ] Quote-to-invoice conversion with PO# and AP email
- [ ] Subscription checkout flow (mode: "subscription")
- [ ] CloudFront CDN for S3 file distribution
- [ ] Stripe webhook expansion (subscription lifecycle events)
- [ ] Customer Portal route (Stripe self-service billing)

### Lower Priority
- [ ] Dry ice shipping support verification
- [ ] International shipping customs integration
- [ ] Quote expiration automation (60-day cleanup)
- [ ] Chatbot/FAQ for guiding customers to quote request
- [ ] Pichia strain checkout integration
- [ ] Order fulfillment workflow (ShipStation label creation)
