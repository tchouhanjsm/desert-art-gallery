# Desert Art Gallery — Commerce Product & Delivery Plan

> **Current customer-facing design authority:** [Japan-First Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md). This plan's former Desert Atelier storefront direction is superseded as of 4 November 2026. Owner operations and cost/hosting decisions remain separate.

**Document status:** Proposed product direction  
**Decision date:** 2 November 2026  
**Primary objective:** Build a premium, owner-operable e-commerce platform locally first; validate and deploy it on Hostinger only after the experience and core workflows are implemented and locally tested.

---

## 1. Executive decision

Desert Art Gallery will be developed as a single, cohesive e-commerce application with two connected experiences:

1. **Customer storefront** — an editorial, image-led shopping experience for discovering and purchasing art, textiles, jewellery, handicrafts and curated collections.
2. **Owner Operations Portal** — a secure dashboard through which the gallery owner can manage products, photographs, inventory, collections, homepage content, orders and fulfilment without editing code or using developer tools.

The project will retain the current Next.js application and its working routes and commerce foundations. It will not be replaced wholesale with a generic template.

### Delivery order

The agreed order is:

1. Select the visual direction and component foundations.
2. Design and build the customer storefront locally.
3. Design and build the owner portal locally.
4. Implement and integrate the self-hosted backend and database.
5. Complete real product, media, inventory and order workflows.
6. Run local functional, security, accessibility and production-build checks.
7. Only then test the stable application on Hostinger.
8. Launch and hand over the operational portal to the owner.

**Hostinger deployment is deliberately not the first milestone.** Hosting compatibility, persistent media storage and final plan selection will be proven after the product has been built and locally validated. No hosting purchase is authorised by this plan.

---

## 2. Product principles

The project will be judged as a commercial product, not only as a collection of web pages.

- **Owner independence:** normal product and content changes must not require a developer, GitHub commit or deployment.
- **Commerce integrity:** prices, stock, orders and payment state must be controlled by server-side logic and database transactions.
- **Photography-led merchandising:** original, rights-cleared product photography is a core part of the experience.
- **Premium presentation:** the storefront should feel like a curated contemporary craft and art gallery, not a generic marketplace or template demo.
- **Operational simplicity:** the owner dashboard should prioritise frequent business tasks over developer-centric controls.
- **Cost discipline:** prefer existing project assets, open-source dependencies and the eventual hosting plan's included services. Avoid paid commerce SaaS, hosted database subscriptions and unnecessary recurring services.
- **Portability:** keep storage, database and payment integrations behind application interfaces so a hosting-provider change does not require rewriting the storefront.
- **Incremental proof:** every major phase must produce a working, reviewable outcome.

---

## 3. Theme and template selection

### 3.1 Selected storefront direction: Japan-first curated lifestyle ecommerce

**Decision (4 November 2026):** replace the previous Desert Atelier / Contemporary Heritage / Desert Modern public theme with the Japanese-first customer storefront described in [`docs/JAPAN-ECOMMERCE-REDESIGN.md`](./JAPAN-ECOMMERCE-REDESIGN.md). That brief is the source of truth. The former palette, typography and hotel/gallery-destination homepage composition are retired.

Creative references:

- [POJ Studio](https://pojstudio.com/) — premium editorial product presentation, collection merchandising, craft stories and useful product information.
- [Macaroni Shoten](https://shop.macaro-ni.jp/) — accessible everyday curation, lifestyle framing and direct category discovery.
- [TokyoTronic Japanese ecommerce layout guidance](https://www.tokyotronic.com/how-japanese-ecommerce-pages-are-laid-out/) — practical header/navigation, search, breadcrumbs, filters, item counts, product decision content and shipping/reassurance architecture.
- [Nextcreative Japanese web design guidance](https://nextcreative.jp/en/blog/japanese-web-design-foreign-companies) — localisation beyond literal translation, complete trust information, Japanese content structure and mobile-first detail.

Do not clone the reference brands or assume their categories/products/policies exist in this catalogue. The customer should recognise a real online shop in the first viewport.

#### Creative and interaction direction

- Japanese-first shopping UI with a compact multi-zone header, visible search, account/cart controls and a useful category row.
- Product-led campaign hero, category discovery and published product grid near the top of the homepage.
- Editorial stories support shopping; long destination introductions do not precede product discovery.
- Category pages include real counts, functional filters/sorts and mobile two-column grids where the catalogue justifies them.
- Product details place real price/currency, stock, variants and configured delivery/tax disclosures near the purchase control.
- Cart and checkout use natural Japanese labels and field-level guidance while preserving the existing server-authoritative order flow.
- The owner/admin workspace remains a separate operational product.

#### Initial public design tokens

| Token | Value | Usage |
|---|---|---|
| Warm ivory | `#F5F0E7` | Main page canvas |
| Soft ivory | `#FBF9F5` | Cards/surfaces |
| Ink | `#25231F` | Text and structural UI |
| Terracotta | `#A54E34` | Restrained accent |
| Muted sand | `#A79B7D` | Secondary detail |
| Warm grey | `#716A61` | Supporting text |
| Border | `#DED7CC` | Rules and controls |

Initial CSS lives in `src/styles/japan-storefront.css`. The active root layout sets `lang="ja"`. Its current Japanese font stack uses system fallbacks; a bundled JP font is a separate measured/licensed decision. Browser glyph and contrast checks remain required.

#### Product content and commerce safeguards

- Keep Etsy English titles/descriptions intact until owner-entered Japanese content has been reviewed by a qualified Japanese-language reviewer.
- Preserve the CSV's USD source currency. Do not convert to JPY or claim tax-included prices without an approved merchant price/tax decision.
- The supplied export has no category or variation fields. Do not infer categories, variant combinations or best-seller rankings.
- Keep product images private until owner mapping and usage rights are confirmed.
- Preserve backend/API/authentication/catalogue/inventory/shipping/tax/checkout contracts. Presentation changes do not authorise database or payment changes.

### 3.2 Storefront reference: Epic Design Labs Next.js Ecommerce Starter

Repository: https://github.com/Epic-Design-Labs/nextjs-ecommerce-starter

- Its `package.json` declares the MIT licence.
- It demonstrates catalogue, cart, wishlist, checkout, account, search, responsive layouts, metadata and accessible interaction patterns.
- Its current package manifest uses Next.js 16.2.3 and React 19.2.4, while this project currently uses Next.js 15.1.6 and React 19.0.0.
- Its documented demo flows use local browser persistence and a demo checkout provider; those are not a replacement for the project's real server-side order, inventory and payment workflows.

**Adoption decision:** use it as a reference for selected interaction and accessibility patterns only. Do not wholesale-copy its application, replace current routes or import its complete dependency tree. Re-check the upstream licence and notices before copying any source files.

### 3.3 Selected owner-portal reference: Tailwind Admin

Repository: https://github.com/Tailwind-Admin/free-tailwind-admin-dashboard-template

- The repository includes an MIT licence.
- It provides a Next.js version, responsive sidebar/topbar patterns, tables, charts, forms, authentication layouts and reusable UI examples.
- Its current Next.js package is located at `tailwind-admin-nextjs-free/package` and specifies Next.js 16.1.0, React 19.2.3 and Tailwind CSS 4.1.6.
- The current application uses Next.js 15.1.6, React 19.0.0 and Tailwind CSS 4.0.0.

**Adoption decision:** select Tailwind Admin as the owner-portal design and component reference. Port only the required components and visual patterns into the current application. Do not transplant the full project or force a framework upgrade as a side effect. Preserve the MIT licence notice for any copied or adapted portions.

The owner portal should use a restrained neutral operations theme, with the storefront's typography and accent colours carried through as brand continuity. It does not need to look like the customer storefront.

### 3.4 Component foundation

Use Tailwind CSS already present in the application and adopt shadcn-style, accessible primitives selectively where useful. Keep the installed Next.js/React versions stable during the first design implementation unless a separate compatibility review demonstrates a compelling reason to upgrade.

Do not install a second dashboard application or duplicate the existing cart/auth/catalogue implementation.

### 3.5 Figma use

Figma is the design review and handoff space, not the application's runtime dependency.

Create a design file or equivalent review boards for:

- Storefront moodboard and visual principles.
- Colour, typography, spacing and component tokens.
- Desktop and mobile homepage.
- Shop and product detail.
- Cart and checkout.
- Owner dashboard shell.
- Product editor and media-library workflows.

Only use community assets/templates whose current licence permits the intended commercial use. Record source and attribution requirements where applicable. The final interface should be adapted to Desert Art Gallery, not left looking like a copied demo.

---

## 4. Product experience and owner workflows

### 4.1 Customer storefront

The storefront must support product discovery through categories, collections, search, filters and editorial content. Product pages must communicate accurate price, availability, images, variant information, dimensions/materials and fulfilment expectations.

Checkout will remain disabled or clearly in preview mode until order creation, stock handling and payment-state rules are implemented and tested. Demo payment success must never be represented as a real payment.

### 4.2 Owner Operations Portal

The owner portal is a first-class product requirement, not a later cosmetic admin theme.

| Module | Owner capability |
|---|---|
| Overview | See orders awaiting action, sales summary and low-stock alerts |
| Products | Create, edit, duplicate, draft, publish, archive and restore products |
| Media library | Upload, preview, reorder, set primary image, add alt text and replace images |
| Collections | Create and edit collections, order products and set collection imagery |
| Homepage editor | Change hero image/copy, featured collections and promotional sections |
| Artisans and journal | Create, edit, preview and publish profiles/articles |
| Inventory | Adjust quantity, availability and variants with an audit trail |
| Orders | View order details, update fulfilment, add tracking and manage permitted cancellations |
| Customers | Review customer accounts and order history with appropriate permissions |
| Settings | Manage store contact details, shipping configuration and content settings |

#### Critical owner acceptance journey

A non-technical owner must be able to:

1. Sign into the portal from a desktop or phone.
2. Create a product with name, description, price, category, SKU and inventory.
3. Upload multiple original photographs.
4. Reorder photographs and choose the cover image.
5. Add alt text and product attributes.
6. Save the product as a draft and preview it.
7. Publish the product.
8. Open the public storefront and see the new product and photographs without a code change or deployment.

The same principle applies to changing homepage imagery and collection content.

---

## 5. Proposed technical architecture

The current repository already contains a Next.js App Router application with customer pages, admin routes, Supabase integration, commerce helpers, tests and a database migration foundation.

The target architecture is:

| Layer | Proposed technology | Responsibility |
|---|---|---|
| Application | Existing Next.js App Router + React + TypeScript | Storefront and owner portal |
| Styling | Existing Tailwind CSS + design tokens | Responsive visual system |
| Accessible components | Selectively adapted shadcn-style primitives | Forms, dialogs, menus, tables and feedback |
| Backend | Next.js server actions and route handlers | Authenticated business operations |
| Database | MySQL supported by the selected hosting plan | Products, media metadata, customers, orders and inventory |
| ORM/migrations | Drizzle ORM + MySQL driver | Typed data access and schema migrations |
| Authentication | Better Auth, subject to implementation/security validation | Credentials, sessions and recovery |
| Media | Hosting-supported durable storage, behind a media-storage interface | Product and editorial images |
| Source control | GitHub | Versioned source, reviews and CI |
| Initial hosting candidate | Hostinger Node.js Unlimited | Deployment and managed MySQL, subject to later proof |

### 5.1 Database migration

The existing application uses Supabase clients and PostgreSQL migrations. This is not a simple connection-string change.

The migration must account for:

- PostgreSQL-to-MySQL data types and indexes.
- Foreign keys, unique constraints and check constraints.
- PostgreSQL functions/triggers that need MySQL or application-service equivalents.
- Row-level security rules that need explicit server-side authorization.
- Atomic order creation and stock reservation.
- Idempotent payment webhook processing.
- Safe ownership checks for customer addresses and orders.
- Audit history and restricted role changes.

All privileged database access must remain server-side. Browser code must never receive database credentials or unrestricted access.

### 5.2 Media architecture

Product photographs must not be stored only inside a deployment directory that is replaced during releases.

- Store image files in a verified persistent directory or durable storage service.
- Store image metadata, product relationships, order and display position in MySQL.
- Keep storage operations behind a media service interface.
- Validate file signature, MIME type, size and dimensions.
- Use generated filenames; do not trust user-supplied paths.
- Support safe replacement, ordering and deletion with reference checks.
- Back up media separately and test restoration.

The exact Hostinger storage path and backup coverage are intentionally deferred to the hosting validation milestone. If the selected plan does not provide safe durable upload storage, an alternative must be chosen before production use.

### 5.3 Database and storage ownership

The gallery owner should own the domain, hosting account, source repository, database credentials, backup access and payment gateway account. Developer access must be role-based and revocable. No personal developer account should be the only way to operate or recover the business.

---

## 6. Delivery phases

The phases are dependency-led. Each phase should deliver coherent, demonstrable functionality and should not be split into tiny PRs for individual files or isolated UI components.

### Phase 0 — Product definition and design lock

**Primary focus: design first.**

Deliverables:

- Confirm the “Desert Atelier — Contemporary Heritage” direction.
- Build the moodboard and visual reference set.
- Define design tokens and typography.
- Produce responsive storefront page designs.
- Produce owner-portal navigation and page designs.
- Review design against gallery-owner workflows.
- Record template references, licences and adaptation boundaries.
- Approve homepage, shop, product detail and owner product-editor layouts.

Exit criteria:

- Desktop and mobile designs are coherent.
- Storefront and owner portal have a consistent component system.
- The product owner can review the expected workflows before implementation.

### Phase 1 — Premium storefront implementation

Deliverables:

- Implement global design tokens and component primitives.
- Redesign homepage, navigation and footer.
- Implement shop, collection and product-detail visual systems.
- Improve product galleries, product cards, search and filtering.
- Refine cart, wishlist, login and account experiences.
- Implement responsive mobile navigation and product browsing.
- Preserve metadata, sitemap, robots and structured data.
- Replace generic placeholder compositions with clearly identified image slots and approved supplied assets.

Exit criteria:

- All existing customer routes render correctly.
- Desktop, tablet and mobile layouts are reviewed.
- No core storefront functionality is lost.
- No made-up product facts, prices, reviews or artisan claims are introduced.

### Phase 2 — Owner portal design and UI implementation

Deliverables:

- Build the dashboard shell using selectively adapted Tailwind Admin patterns.
- Implement responsive navigation and role-aware page structure.
- Build dashboard overview, product list, product editor and media-library UI.
- Add collection, homepage and editorial management screens.
- Add explicit draft, preview, publish and archive states.
- Use typed service interfaces and controlled development fixtures while backend migration is in progress.

Exit criteria:

- Every owner workflow has a usable screen and a defined server contract.
- Empty, loading, error, validation and success states exist.
- The portal is usable on common mobile widths.
- Demo fixtures are clearly identified and cannot be mistaken for live business records.

### Phase 3 — Self-hosted backend and MySQL foundation

Deliverables:

- Add Drizzle schema and MySQL migrations.
- Implement connection management and environment validation.
- Replace Supabase repositories and server operations behind domain interfaces.
- Implement authentication, session handling and role authorization.
- Implement server-side repositories/services for products, collections, customers and orders.
- Translate security rules into explicit authorization checks.
- Add migration, repository and security tests.
- Preserve existing data contracts where safe; document any incompatible changes.

Exit criteria:

- Local MySQL environment runs the migrations from an empty database.
- No production business operation depends on Supabase.
- Privileged operations are server-side and role-checked.
- Existing unit tests are preserved or replaced with equivalent coverage.

### Phase 4 — Owner workflow integration and media management

Deliverables:

- Connect product editor to MySQL.
- Implement multi-image upload and durable media adapter.
- Add image sorting, primary image, alt text and safe deletion.
- Connect collections and homepage sections to real data.
- Implement artisan and journal CRUD/publication.
- Add product draft and publication validation.
- Add audit events for sensitive content and inventory changes.

Exit criteria:

- The complete product-to-publication owner journey passes locally.
- A homepage or product image can be changed without application code changes.
- Upload failures and interrupted operations do not corrupt product records.
- Storage replacement and deletion preserve referential integrity.

### Phase 5 — Commerce and operational workflows

Deliverables:

- Server-validated checkout and order creation.
- Transactional stock validation/reservation.
- Order and order-item snapshots of price and product data.
- Idempotency for duplicate checkout submissions and webhooks.
- Initial COD/manual UPI workflow.
- Razorpay integration only after merchant account and webhook configuration are available.
- Fulfilment and tracking workflows.
- Cancellation and refund state transitions.
- Transactional email integration through a selected provider, or a clearly documented manual fallback until configured.

Exit criteria:

- Concurrent checkout cannot oversell inventory.
- Failed payment does not mark an order paid.
- Duplicate events do not duplicate payment or stock effects.
- Owner order operations are fully auditable.

### Phase 6 — Local quality, security and release readiness

Deliverables:

- Unit and integration tests for business logic and repositories.
- End-to-end browser tests for customer and owner flows.
- Accessibility checks for keyboard operation, contrast and labels.
- Responsive visual review.
- SEO and metadata verification.
- Image optimisation and performance profiling.
- Security tests for authorization, file uploads, input validation and session boundaries.
- Production build, startup and environment checks.
- Backup and restore procedure documented and exercised locally where possible.

Exit criteria:

- Typecheck, tests, lint and production build pass.
- No known critical or high-severity security defects remain.
- End-to-end customer purchase and owner product-publishing scenarios pass in the local/staging test environment.
- Production secrets are not committed to the repository.

### Phase 7 — Hostinger staging and deployment validation

**This is intentionally after design, implementation and local QA.**

Deliverables:

- Re-check current Hostinger Node.js plan specification and final checkout terms.
- Deploy the stable application to a staging/subdomain environment.
- Configure MySQL and production-like environment variables.
- Verify deployment, runtime, server actions and route handling.
- Verify that media uploads survive application redeployment and restart.
- Verify database backup and restore options.
- Exercise owner and customer workflows on the hosted environment.
- Measure response time, memory and resource use.
- Resolve host-specific compatibility issues without compromising data integrity.

Exit criteria:

- The full application works on the actual selected plan.
- Uploaded images remain available after redeployment and restart.
- Database and media recovery have been demonstrated.
- No critical workflow depends on local development settings.

No Hostinger subscription purchase is authorised until plan cost, renewal amount, database limits and durable media storage are confirmed.

### Phase 8 — Production launch and owner handover

Deliverables:

- Connect the business domain and HTTPS.
- Configure production secrets and admin accounts.
- Load only owner-approved products, content and media.
- Run live smoke tests.
- Train the owner on products, photos, collections, orders and content updates.
- Deliver an operational runbook and recovery instructions.
- Confirm account ownership and access transfer.
- Establish a release and backup routine.

Exit criteria:

- The owner can independently manage products, images and content.
- A test order has been followed through the correct lifecycle.
- The business has access to its hosting, database, source and recovery credentials.
- The production deployment is documented and supportable.

---

## 7. Repository and engineering conventions

The current route structure should remain under `src/app`. Organise the rest of the code by responsibility rather than forcing all HTML-equivalent, CSS and JavaScript into unrelated global folders.

Proposed direction:

```text
src/
  app/                  # Next.js routes, layouts, APIs
  components/
    storefront/
    products/
    layout/
    admin/
    shared/
  features/
    catalogue/
    media/
    inventory/
    collections/
    orders/
    customers/
    content/
    checkout/
  server/
    db/
    auth/
    repositories/
    services/
    storage/
  styles/
    tokens.css
    typography.css
    components/
  hooks/
  types/
  config/

drizzle/
  schema/
  migrations/

public/
  images/
    brand/
    design-assets/

tests/
docs/
```

Actual placement must be determined by import dependencies and feature ownership. Avoid mechanical mass moves that break route boundaries, server/client component boundaries or existing tests.

### Pull request strategy

- Deliver each phase as one coherent, reviewable milestone PR where practical.
- Do not create a PR for every component, folder or tiny change.
- Group related UI, functionality, tests and documentation together.
- Run local checks before pushing to reduce unnecessary GitHub Actions usage.
- Fix failing checks before merge.
- Do not merge incomplete design or backend phases merely to make a PR green.

### Local quality commands

The existing project currently defines:

- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`

Add browser-level checks as part of the implementation, while keeping the CI workflow appropriate to the available GitHub Actions budget.

---

## 8. Initial design review checklist

The first design milestone must review at least these compositions before broad implementation:

### Storefront

- Homepage at desktop and mobile widths.
- Product listing with filters and sorting.
- Product detail with image gallery and purchase panel.
- Collection storytelling and category discovery.
- Cart and checkout.
- Search, no-results and empty states.
- Footer, mobile menu and navigation.

### Owner portal

- Dashboard overview.
- Product catalogue table.
- New/edit product form.
- Multi-image media uploader and gallery ordering.
- Collection editor.
- Homepage content editor.
- Order list and order detail.
- Mobile owner workflow.

### Visual quality criteria

- Clear hierarchy and legible type at every breakpoint.
- Realistic product photography and consistent crop treatment.
- No placeholder images presented as genuine products.
- Consistent action hierarchy and form feedback.
- Accessible contrast and keyboard focus.
- Useful loading, error and empty states.
- No layout shift or horizontal overflow at mobile widths.
- The storefront and admin feel related but serve different jobs.

---

## 9. Risks and controls

| Risk | Control |
|---|---|
| Template dependency mismatch | Adapt selected components; do not transplant incompatible applications |
| Supabase-to-MySQL migration breaks existing behaviour | Introduce repositories, migrate one domain at a time, retain contract tests |
| Owner uploads lost on deployment | Prove persistent media storage before hosted launch |
| Overselling or duplicate orders | Transactional inventory and idempotency tests |
| Insecure owner operations | Server-side session and role enforcement; audit log |
| Unverified product/brand claims | Use owner-approved facts and supplied rights-cleared media only |
| Hosting resource limits | Profile locally; validate on selected plan after implementation |
| Free-tier or promotional pricing changes | Confirm final checkout and renewal costs before purchase |
| Owner cannot operate the system | Acceptance-test owner journeys and deliver training |

---

## 10. Decision log

| Decision | Status |
|---|---|
| Existing Next.js application remains the product foundation | **Accepted** |
| Design and local build happen before Hostinger deployment testing | **Accepted** |
| Storefront theme: Desert Atelier — Contemporary Heritage | **Selected direction; final tokens/designs require review** |
| Storefront template: custom implementation; Epic starter used selectively as reference | **Selected approach** |
| Owner portal reference: Tailwind Admin free Next.js variant | **Selected reference; port components selectively** |
| Tailwind CSS and accessible shadcn-style primitives | **Preferred component foundation** |
| Target backend: MySQL + Drizzle, replacing Supabase | **Proposed; migration design and host DB limits to validate** |
| Authentication: Better Auth | **Proposed; security and compatibility validation required** |
| Hostinger Node.js Unlimited | **Preferred hosting candidate; not yet purchased or proven** |
| Persistent media storage on Hostinger | **Open technical proof; launch blocker** |
| Cloud Startup tier | **Not justified until measured resource needs require it** |
| Online payment gateway | **Later phase, after order integrity and merchant setup** |

---

## 11. Upstream references

All third-party code must be checked against the licence and current upstream state immediately before copying or adapting.

### Storefront and UI

- Epic Design Labs Next.js Ecommerce Starter (MIT declared in package): https://github.com/Epic-Design-Labs/nextjs-ecommerce-starter
- Tailwind Admin free multi-framework dashboard (MIT): https://github.com/Tailwind-Admin/free-tailwind-admin-dashboard-template
- shadcn/ui: https://ui.shadcn.com/

### Backend

- Drizzle ORM MySQL documentation: https://orm.drizzle.team/docs/get-started/mysql-new
- Better Auth: https://www.better-auth.com/docs/installation

### Hosting candidate

- Hostinger Node.js hosting: https://www.hostinger.com/in/nodejs-hosting
- Hostinger Node.js deployment documentation: https://support.hostinger.com/en/articles/9556255-how-to-deploy-a-node-js-website
- Hostinger managed Node.js limitations: https://support.hostinger.com/en/articles/9556256-what-are-the-limitations-of-node-js-hosting

---

## 12. Definition of success

The project is complete only when all of the following are true:

1. The customer storefront presents Desert Art Gallery as a premium, trustworthy destination for art and craft.
2. A customer can discover a product, add it to the cart and complete a correctly processed order.
3. The owner can add a product, upload and order photographs, publish it and see it on the website without developer intervention.
4. The owner can update homepage and collection imagery without a deployment.
5. Inventory, order and payment state remain consistent under retries and concurrent requests.
6. The system can be backed up and restored.
7. The application passes local quality gates and hosted acceptance tests.
8. The business owns its domain, hosting, database, media, repository and operational access.
9. Recurring infrastructure costs remain within the owner's approved budget.

**The immediate next milestone is Phase 0 followed by Phase 1: establish the design system and build the storefront locally. The Hostinger deployment proof comes later, after the design and application are ready.**
