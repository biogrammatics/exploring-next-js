# BioGrammatics Company Site

A full-stack e-commerce platform for BioGrammatics, built with Next.js 16, featuring product management (vectors, strains), subscription services, custom protein projects, codon optimization, and Stripe payments.

**Live Site**: https://beta.biogrammatics.com

## Tech Stack

- **Framework**: Next.js 16.1.1 with React 19 and TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with magic link emails (Resend)
- **Payments**: Stripe Checkout
- **File Storage**: AWS S3
- **Styling**: Tailwind CSS v4
- **Deployment**: Render (web service + background worker + PostgreSQL)

## Features

### Product Catalog
- **Vectors**: Expression vectors with technical specifications (promoter, selection marker, host organism, vector type)
- **Pichia Strains**: Host strains with genotype, phenotype, and growth conditions
- **File Downloads**: SnapGene maps, GenBank files, FASTA sequences, product sheets stored in AWS S3
- **Lot Tracking**: Manufacturing lots with QC files for traceability

### Shopping & Checkout
- Shopping cart with localStorage persistence (works for guests)
- Guest checkout with optional account creation
- Pre-filled addresses for logged-in users
- Stripe-powered secure payment

### User Account
- Passwordless email authentication (magic links)
- Team access: Multiple emails can log into the same account
- Profile management (name, phone, shipping address)
- Order history and tracking
- Subscription management (Twist Bioscience integration)

### Custom Protein Projects
- Multi-step project workflow
- Amino acid sequence input
- Codon optimization (background worker)
- DNA sequence approval process
- Secretion signals and protein tags

### Service Pathway
- 6-step DIY vs. Service funnel
- Quote generation
- Admin follow-up tracking

### Admin Dashboard
- Vector management with file uploads
- Lot management with QC file uploads
- Strain management
- Order management with status updates
- User management and role assignment (USER, ADMIN, SUPER_ADMIN)

## Project Structure

```
company-site/
├── src/
│   ├── app/
│   │   ├── (auth pages)           # Sign-in, verify, error
│   │   ├── account/               # User account, orders, team
│   │   ├── admin/                 # Admin dashboard
│   │   │   ├── orders/            # Order management
│   │   │   ├── strains/           # Strain CRUD
│   │   │   ├── users/             # User management
│   │   │   └── vectors/           # Vector CRUD with lots & files
│   │   ├── api/                   # API routes
│   │   │   ├── admin/             # Admin APIs
│   │   │   ├── auth/              # Auth APIs
│   │   │   ├── checkout/          # Stripe checkout
│   │   │   ├── codon-optimization/# Optimization jobs
│   │   │   └── webhooks/          # Stripe webhooks
│   │   ├── cart/                  # Shopping cart
│   │   ├── checkout/              # Checkout flow
│   │   ├── codon-optimization/    # Codon optimization tool
│   │   ├── products/              # Generic products
│   │   ├── strains/               # Strain catalog
│   │   └── vectors/               # Vector catalog
│   ├── lib/
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── db.ts                  # Prisma client
│   │   ├── s3.ts                  # AWS S3 utilities
│   │   └── stripe.ts              # Stripe client
│   └── generated/prisma/          # Generated Prisma client
├── prisma/
│   └── schema.prisma              # Database schema
├── worker/
│   └── codon-worker.ts            # Background worker for optimization
└── render.yaml                    # Render deployment config
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Stripe account
- Resend account (for emails)
- AWS account (for S3 file storage)

### Installation

1. Clone and install:

```bash
cd company-site
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Configure `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/biogrammatics?schema=public"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Auth
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"

# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="BioGrammatics <noreply@links.biogrammatics.com>"

# AWS S3
AWS_REGION="us-west-2"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="biogrammatics-files"
```

4. Set up database:

```bash
npx prisma generate
npx prisma db push
```

5. Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Stripe Webhooks (Development)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Database Commands

```bash
npx prisma generate    # Generate Prisma client
npx prisma db push     # Push schema changes
npx prisma studio      # Open Prisma Studio GUI
```

## Deployment

Deployed on Render with:
- **Web Service**: Next.js application
- **Background Worker**: Codon optimization job processor
- **PostgreSQL**: Managed database

See `render.yaml` for configuration.

## Data Models

### Core Entities
- **User**: Authentication, roles, profile with addresses, team access
- **Vector**: Expression vectors with taxonomy (promoter, marker, type, organism)
- **PichiaStrain**: Host strains with biological details
- **Product**: Generic products (legacy support)

### File Management
- **VectorFile**: Canonical files (SnapGene, GenBank, FASTA, product sheets)
- **VectorLot**: Manufacturing lots for traceability
- **VectorLotFile**: Lot-specific QC files (sequencing data, COA)

### Orders & Subscriptions
- **Order**: Orders with status tracking and shipping
- **VectorOrderItem**: Vector purchases with lot tracking
- **Subscription**: Twist Bioscience subscription integration

### Projects & Services
- **CustomProject**: Custom protein expression projects
- **ServiceQuote**: Quote requests from service pathway
- **CodonOptimizationJob**: Async codon optimization jobs

## To-Do List

### High Priority
- [ ] **CloudFront CDN**: Add CloudFront distribution for global file delivery
  - Create CloudFront distribution pointing to S3 bucket
  - Update download routes to use CloudFront signed URLs
  - Configure HTTPS with SSL certificate
- [ ] **Strain file uploads**: Add S3 file storage for Pichia strains
- [ ] **Public strain files**: Display strain files on catalog pages

### Medium Priority
- [ ] **Lot shipping assignment**: UI for assigning lots to order line items
- [ ] **Subscription checkout**: Stripe subscription integration
- [ ] **Custom project workflow**: Complete project status flow
- [ ] **Bulk file upload**: Drag-and-drop multiple files
- [ ] **File previews**: Image thumbnails, PDF previews

### Lower Priority
- [ ] **Order email notifications**: Send emails on status changes
- [ ] **Inventory tracking**: Stock levels per lot
- [ ] **Analytics dashboard**: Sales and usage metrics
- [ ] **API rate limiting**: Protect public endpoints
- [ ] **Search**: Full-text search across products

### Technical Debt
- [ ] **Error handling**: Consistent error boundaries
- [ ] **Loading states**: Skeleton loaders for async content
- [ ] **Tests**: Unit and integration tests
- [ ] **Audit logging**: Track admin actions

## License

Proprietary - BioGrammatics, Inc.
