# BioGrammatics Next.js - Project Status & Roadmap

This document tracks the current state of the application and planned work.

---

## SCHEMA ARCHITECTURE

### Products: Vectors & Strains

Vectors and strains are the core products — tangible goods that customers purchase, own, and receive with lot-specific QC documentation.

**Vector system (fully implemented in schema + admin UI):**
- `Vector` — catalog product with pricing, taxonomy, availability, thumbnail
- `VectorFile` — canonical files in S3 (SnapGene, GenBank, FASTA, product sheets, images)
- `VectorLot` — manufacturing batch tracking (lot number, dates, current shipping lot)
- `VectorLotFile` — lot-specific QC files (sequencing data, COA, QC reports)
- `VectorOrderItem` — purchase tracking with `shippedLotId` for traceability

**Strain system (schema complete, admin UI needed):**
- `PichiaStrain` — catalog product with pricing, biological details, thumbnail
- `StrainFile` — canonical files in S3 (images, datasheets, product sheets)
- `StrainLot` — manufacturing batch tracking (mirrors VectorLot)
- `StrainLotFile` — lot-specific QC files (reuses LotFileType enum)
- `StrainOrderItem` — purchase tracking with `shippedLotId` for traceability

Both products use the same patterns: S3 file storage, lot-based traceability, `currentShippingLotId` for active inventory, and `isPublic` for catalog visibility.

### Customer Ownership

Customers "own" products through three paths:
1. **Purchase** — `VectorOrderItem` or `StrainOrderItem` on a paid order, with lot traceability
2. **Subscription** — `SubscriptionVector` for Twist Bioscience integrations (no lot — digital/licensing access)
3. **Project output** — custom vectors/strains created by projects, invoiced as paid order line items

### Project System (schema complete, UI needed)

Projects are work engagements where the company creates custom products for customers. The system supports:

- **`Project`** — top-level engagement with status tracking (DRAFT → IN_PROGRESS → COMPLETED)
- **`ProjectVector`** — many-to-many join with roles:
  - `INPUT_OWNED` — customer's existing vector used as input
  - `OUTPUT` — new vector being built for customer
  - Tracks integration method (SwaI linearization, PCR, etc.)
- **`ProjectStrain`** — many-to-many join with roles:
  - `INPUT_RESOURCE` — company's host strain (BG10, GS115, etc.) used in transformation
  - `OUTPUT` — new strain produced for customer
- **`ProjectMilestone`** — progress tracking per product (visible to customer on dashboard)
- **`ProjectOrder`** — links projects to invoices (supports deposits, milestone payments)
- **`ProjectProtein`** — protein sequence tracking within projects
- **`MilestoneTemplate`** — standard milestone sets auto-applied when products are added

**Customer dashboard lifecycle:**
- Active project shows at top with milestone progress per product
- Completed project products move to My Vectors / My Strains sections
- Products sortable/filterable by project, date, etc.

### Legacy Models (to be removed after migration)

- `CustomProject` / `Protein` — replaced by the new Project system
- `Product` / `OrderItem` — generic legacy models, replaced by typed Vector/Strain order items
- `Address` — defined but unused (checkout captures addresses inline on Order)
- `ServicePackage` / `PathwaySelection` / `ServiceQuote` — planned service funnel, not yet implemented

---

## COMPLETED

### Core Infrastructure
- [x] PostgreSQL + Prisma schema with full biotech domain model
- [x] NextAuth authentication with magic links
- [x] User role system (USER, ADMIN, SUPER_ADMIN)
- [x] S3 file storage integration
- [x] Stripe checkout integration
- [x] ShipStation shipping rate integration

### Vector Management (Admin)
- [x] Vector CRUD with taxonomy relations
- [x] Vector file upload to S3 (SnapGene, GenBank, FASTA, product sheets)
- [x] Vector map image upload (1200x1200 PNG to S3 + 400x400 thumbnail to DB)
- [x] Vector lot management (create, edit, set current shipping lot)
- [x] Lot-specific QC file upload
- [x] Vector visibility toggle (isPublic)
- [x] Delete protection (can't delete vectors with orders/subscriptions/projects)

### Strain Management (Admin)
- [x] Strain CRUD with type/status relations
- [x] Strain visibility toggle (isPublic)
- [ ] Strain file upload (schema ready, UI needed — mirror vector pattern)
- [ ] Strain lot management (schema ready, UI needed — mirror vector pattern)
- [ ] Strain image/thumbnail upload (schema ready, UI needed)

### Public Catalog
- [x] Vector catalog page with category grouping
- [x] Vector detail page with specs, downloads, add to cart
- [x] Strain catalog page
- [x] Strain detail page

### E-Commerce
- [x] Shopping cart (context-based, supports vectors + strains)
- [x] Checkout with Stripe (creates VectorOrderItem records)
- [x] Shipping address capture
- [x] Shipping rate calculation (ShipStation)
- [ ] StrainOrderItem creation in checkout (schema ready, code needed)
- [ ] Auto-assign `shippedLotId` from `currentShippingLotId` at checkout

### Customer Dashboard
- [x] My Vectors (purchased vectors with order details)
- [x] My Strains (purchased strains with order details)
- [x] Vector detail with canonical files + lot QC files
- [ ] Active project progress view (schema ready, UI needed)

### Codon Optimization
- [x] Web-based codon optimization tool
- [x] Beam search optimizer for Pichia pastoris
- [x] DP optimizer
- [x] Restriction enzyme exclusion (vector-specific + Golden Gate)
- [x] Async job processing with worker
- [x] Email notification on completion

### Admin Dashboard
- [x] Overview metrics (vectors, strains, orders, users)
- [x] Recent orders display
- [x] User management with role assignment
- [x] Contextual sidebar navigation (Manage Lots links on edit pages)

### Security & Compliance
- [x] Security documentation (SECURITY_README.md)
- [x] Cookie policy page
- [x] Privacy policy page
- [x] Magic link authentication with rate limiting
- [x] Team access (authorized emails per account)

---

## NEXT UP

### Immediate (Schema-driven)
- [ ] Strain admin UI parity — file upload, lot management, image upload (mirror vector admin)
- [ ] Wire up `shippedLotId` in checkout (auto-assign `currentShippingLotId`)
- [ ] Create `StrainOrderItem` records in checkout (currently only vectors get order items)
- [ ] Unify file download route (`/api/files/[id]/download` for both public + dashboard)

### Project System (New Feature)
- [ ] Admin: Project CRUD (create, list, edit projects)
- [ ] Admin: Add/remove vectors and strains to projects with roles
- [ ] Admin: Milestone management (create from templates, update status)
- [ ] Admin: Link orders/invoices to projects
- [ ] Customer: Active project progress view on dashboard
- [ ] Customer: Completed project products in My Vectors / My Strains
- [ ] Seed milestone templates (Custom Vector Build, Strain Generation)

### Subscription System
- [ ] Subscription management UI
- [ ] Add vectors to subscription
- [ ] Twist Bioscience username integration
- [ ] Customer dashboard subscription view

### Additional
- [ ] Admin reference data CRUD (promoters, selection markers, host organisms, etc.)
- [ ] Order management improvements (admin fulfillment workflow)
- [ ] Email notifications (order confirmation, project status updates)
- [ ] Cookie consent banner
