# BioGrammatics Rails → Next.js Migration Plan

## Overview

Migrate biotech e-commerce features from Rails app to Next.js, achieving feature parity while keeping both codebases experimental.

**Source:** `/Users/studio/Claude/biog_website` (Rails 8)
**Target:** `/Users/studio/.claude-worktrees/exploring-next-js/eager-kirch/company-site` (Next.js 16)

---

## Phase 1: Data Models & Schema

Extend the existing Prisma schema to support BioGrammatics domain.

### 1.1 Product Taxonomy Models
```
- HostOrganism (scientific_name, common_name, optimal_conditions)
- Promoter (name, full_name, strength, inducible)
- SelectionMarker (name, resistance_type, concentration)
- VectorType (name)
- ProductStatus (name, is_available)
- SecretionSignal (name, sequence, organism, active)
- ProteinTag (name, sequence, tag_type, active)
```

### 1.2 Replace Generic Product with Specialized Types
```
- Vector (extends current Product concept)
  - Relations: promoter, selection_marker, vector_type, host_organism, product_status
  - Fields: sale_price, subscription_price, category, snapgene_file_url

- PichiaStrain
  - Relations: strain_type, product_status
  - Fields: genotype, phenotype, advantages, applications, storage_conditions
```

### 1.3 Subscription Models
```
- Subscription
  - Relations: user, subscription_vectors
  - Fields: twist_username, onboarding_fee, minimum_prorated_fee, status, started_at, renewal_date

- SubscriptionVector (join table)
  - Fields: added_at, prorated_amount
```

### 1.4 Custom Project Models
```
- CustomProject
  - Relations: user, selected_vector, proteins
  - Fields: project_name, description, status, project_type
  - DNA fields: dna_sequence, dna_sequence_approved, codon_optimization_notes
  - Service flags: strain_generation, expression_testing, copy_number_determination

- Protein
  - Relations: custom_project
  - Fields: name, amino_acid_sequence, secretion_signal, n_terminal_tag, c_terminal_tag, molecular_weight
```

### 1.5 Service Pathway Models
```
- ServicePackage (6-step funnel definition)
- PathwaySelection (user's DIY vs Service choices)
- ServiceQuote (quote requests with contact info)
```

---

## Phase 2: Core Business Logic

### 2.1 Amino Acid Validation
Port the `AminoAcidSequenceValidation` concern to TypeScript:
- Valid IUPAC codes validation
- Methionine start requirement
- Stop codon handling
- Molecular weight estimation
- Sequence cleaning utilities

### 2.2 FASTA Parser Service
Create `/src/lib/fasta-parser.ts`:
- Parse FASTA format (header + sequence)
- Multi-sequence support
- Validation and error collection
- Sequence cleaning (add M prefix, ensure stop codon)

### 2.3 Pricing & Calculations
- `TaxCalculationService` - state/province tax rates
- `ShippingCalculationService` - address-based shipping
- Subscription prorating logic

### 2.4 Cart Enhancement
Current cart is client-side only. Options:
- Keep client-side for simplicity (current approach)
- Add server-side cart for logged-in users (Rails approach)
- Hybrid: sync on login

---

## Phase 3: Product Catalog

### 3.1 Vector Catalog
- `/products/vectors` - filterable list
- `/products/vectors/[id]` - detail page with SnapGene viewer
- Filters: category, host organism, promoter strength, availability
- Dual pricing display (sale vs subscription)

### 3.2 Pichia Strain Catalog
- `/products/strains` - list with strain type filter
- `/products/strains/[id]` - detail with genotype/phenotype info

### 3.3 Admin Product Management
Extend existing admin to handle:
- Vector CRUD with taxonomy relations
- Strain CRUD with file attachments
- Promoter/Marker/etc. reference data management

---

## Phase 4: Custom Projects & Services

### 4.1 Project Request Forms
- `/services/protein-expression` - simple single-protein form
- `/services/enhanced-expression` - multi-protein with FASTA upload
- Form validation using amino acid rules
- Vector selection integration

### 4.2 Project Dashboard
- `/account/projects` - list user's projects
- `/account/projects/[id]` - detail with status timeline
- DNA sequence approval workflow

### 4.3 Service Pathway Funnel
- `/services/pathway` - 6-step interactive guide
- `/services/pathway/step/[n]` - individual step pages
- `/services/quote` - quote request form
- Session-based selection tracking (works for anonymous users)

---

## Phase 5: Subscriptions (Twist Integration)

### 5.1 Subscription Management
- `/account/subscription` - view/manage subscription
- Vector addition with prorating
- Renewal tracking

### 5.2 Admin Subscription Tools
- `/admin/subscriptions` - manage all subscriptions
- Activation workflow
- Renewal notifications

---

## Phase 6: Authentication (Flexible)

### Option A: Keep Passwordless (Simpler)
- Current NextAuth email setup
- Works once DNS is properly configured
- Add phone number field to user profile

### Option B: Add Password Auth
- Add password field to User model
- Credentials provider in NextAuth
- Password reset flow

### Option C: Full 2FA (Rails Parity)
- TOTP with `otplib` package
- SMS with Twilio SDK
- Backup codes generation
- Requires significant additional work

**Recommendation:** Start with Option A or B, add 2FA later if needed.

---

## Phase 7: Admin Enhancements

### 7.1 Custom Project Admin
- `/admin/projects` - view all projects
- DNA sequence management interface
- Status updates and notes

### 7.2 Service Quote Admin
- `/admin/quotes` - incoming quote requests
- Status workflow (pending → contacted → quoted → converted)
- Admin notes

### 7.3 Reference Data Admin
- Manage promoters, markers, host organisms, etc.
- Product status control

---

## Implementation Priority

### Tier 1 - Foundation (Do First)
1. Extend Prisma schema with biotech models
2. Port amino acid validation to TypeScript
3. Create FASTA parser utility
4. Add Vector and PichiaStrain models

### Tier 2 - Product Catalog
5. Vector catalog pages with filtering
6. Strain catalog pages
7. Admin CRUD for new product types
8. Reference data management

### Tier 3 - Custom Services
9. Protein expression request forms
10. Project dashboard for users
11. Service pathway funnel
12. Quote request system

### Tier 4 - Subscriptions
13. Subscription model and management
14. Prorating calculations
15. Admin subscription tools

### Tier 5 - Polish
16. Enhanced authentication (if needed)
17. Email notifications
18. File upload handling (SnapGene, FASTA)

---

## Technical Notes

### File Storage
Rails uses Active Storage. For Next.js, options:
- Vercel Blob (simple, integrated)
- AWS S3 (more control)
- Cloudinary (if image processing needed)

### Email Provider
Current Resend setup requires DNS verification. Alternatives:
- SendGrid (generous free tier)
- Postmark (developer-friendly)
- AWS SES (cost-effective at scale)

### Database
Both use PostgreSQL - schema can be migrated or rebuilt fresh with Prisma.

---

## Files to Reference

**Rails Models:** `/Users/studio/Claude/biog_website/app/models/`
**Rails Services:** `/Users/studio/Claude/biog_website/app/services/`
**Rails Controllers:** `/Users/studio/Claude/biog_website/app/controllers/`
**Schema:** `/Users/studio/Claude/biog_website/db/schema.rb`

**Next.js Target:** `/Users/studio/.claude-worktrees/exploring-next-js/eager-kirch/company-site/`
