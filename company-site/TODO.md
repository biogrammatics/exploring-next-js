# Rails to Next.js Migration Todo List

This document tracks features from the Rails BioGrammatics app that need to be implemented in the Next.js version.

---

## HIGH PRIORITY - Core Business Features

### 1. Protein Pathway (6-Step Service Configurator)
- [ ] `/protein_pathway` - Landing/index page
- [ ] Step-by-step guided experience (6 steps)
- [ ] DIY vs. Service selection at each step
- [ ] ServicePackage model and seed data
- [ ] PathwaySelection model for tracking user choices
- [ ] Dynamic pricing calculation
- [ ] Review page showing all selections
- [ ] Quote request form and submission
- [ ] ServiceQuote model for quote tracking
- [ ] Thank you page after submission

### 2. Custom Projects System
- [ ] Project creation form
- [ ] Project listing page (user's projects)
- [ ] Project detail/edit page
- [ ] Project status tracking (pending, in_progress, completed, cancelled, awaiting_approval, sequence_approved)
- [ ] Protein expression request form
- [ ] Enhanced protein expression with FASTA upload (use existing fasta-parser.ts)
- [ ] Amino acid sequence validation in forms (use existing amino-acid-validation.ts)
- [ ] DNA sequence approval workflow
- [ ] Vector selection interface
- [ ] Protein tagging options (N-terminal, C-terminal)
- [ ] Secretion signal selection

### 3. Subscriptions UI
- [ ] `/subscriptions` - Public subscriptions browse page
- [ ] User subscription management page
- [ ] Add vectors to subscription functionality
- [ ] Prorated pricing calculations
- [ ] Renewal date tracking and display
- [ ] Subscription status display (pending, active, expired, cancelled)
- [ ] Twist Bioscience username integration

---

## MEDIUM PRIORITY - E-commerce Enhancements

### 4. Multi-Step Checkout
- [ ] Address step with validation
- [ ] Payment step
- [ ] Review step before confirmation
- [ ] "Use billing address for shipping" checkbox
- [ ] Prefill from user's saved addresses
- [ ] Order summary with tax and shipping

### 5. Session Cart for Guest Users
- [ ] Session-based cart storage for unauthenticated users
- [ ] Cart migration to user account on login
- [ ] SessionCartService equivalent

### 6. Address Management
- [ ] Saved addresses UI in account page
- [ ] Add/edit/delete addresses
- [ ] Set default billing/shipping addresses
- [ ] Address type selection (billing/shipping)

### 7. Tax & Shipping Calculation
- [ ] TaxCalculationService
- [ ] ShippingCalculationService
- [ ] Display calculated values in checkout

---

## MEDIUM PRIORITY - Account & Admin Features

### 8. Enhanced Account Dashboard
- [ ] Active subscriptions display with vectors
- [ ] Custom projects list
- [ ] Saved addresses section
- [ ] Better order history integration
- [ ] Twist username field

### 9. Admin Reference Data Management
- [ ] Promoters CRUD (`/admin/promoters`)
- [ ] Selection Markers CRUD (`/admin/selection-markers`)
- [ ] Host Organisms CRUD (`/admin/host-organisms`)
- [ ] Vector Types CRUD (`/admin/vector-types`)
- [ ] Strain Types CRUD (`/admin/strain-types`)
- [ ] Product Statuses CRUD (`/admin/product-statuses`)
- [ ] Secretion Signals CRUD (`/admin/secretion-signals`)
- [ ] Protein Tags CRUD (`/admin/protein-tags`)

### 10. Vector/Strain File Management
- [ ] SnapGene file upload for vectors
- [ ] Vector map image upload
- [ ] File removal functionality
- [ ] Document attachments for strains

---

## LOWER PRIORITY - Security & Compliance

### 11. Policy Pages
- [x] Cookie policy page (`/cookies`)
- [x] Privacy policy page (`/privacy`)
- [ ] Cookie consent banner/dialog
- [ ] Cookie preference management

### 12. Two-Factor Authentication
- [ ] TOTP (Time-based One-Time Password) setup
- [ ] SMS-based OTP via Twilio
- [ ] Backup codes generation
- [ ] 2FA verification on login
- [ ] Required 2FA for admin users
- [ ] Rate limiting on verification attempts

### 13. Email Notifications
- [ ] Password reset email
- [ ] Order confirmation email
- [ ] Quote request notification email
- [ ] Project status update emails

### 14. SMS Integration
- [ ] Twilio service integration
- [ ] SMS OTP delivery
- [ ] Admin SMS testing tools

---

## COMPLETED

- [x] Prisma schema with biotech models (Vector, PichiaStrain, etc.)
- [x] Seed data for reference tables
- [x] Amino acid validation utility (`src/lib/amino-acid-validation.ts`)
- [x] FASTA parser utility (`src/lib/fasta-parser.ts`)
- [x] Vector catalog pages (`/vectors`, `/vectors/[id]`)
- [x] Strain catalog pages (`/strains`, `/strains/[id]`)
- [x] Admin vectors management (`/admin/vectors`)
- [x] Admin strains management (`/admin/strains`)
- [x] User role system (USER, ADMIN, SUPER_ADMIN)
- [x] Role management UI for Super Admins
- [x] Basic checkout flow
- [x] Shopping cart
- [x] User authentication (NextAuth with magic links)
- [x] Admin dashboard with metrics

---

## Notes

- The Protein Pathway and Custom Projects features are core to BioGrammatics' business model
- Existing utilities (amino-acid-validation.ts, fasta-parser.ts) can be reused
- ServicePackage, PathwaySelection, and ServiceQuote models already exist in schema
- Consider implementing features incrementally, starting with read-only views before full CRUD
