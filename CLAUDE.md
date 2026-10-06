# CLAUDE.md

## Project Overview

**TradeLoop** (repo: `trade-route-frontend`) is a logistics operations platform for Philippine seafood and agricultural trading/logistics businesses. This repo is the **Next.js app**; the data and workflows live in the **TradeLoop API** (`../../Nodejs backend/tradeloop-backend`, NestJS + PostgreSQL), which seeds realistic, structured, fictional demo data.

The design partner is **Lucena Fresh Trading & Logistics**, a fictional operator based in **Lucena City, Quezon Province**. It runs two 10-wheeler closed vans.

Typical operations:

- **Outbound from Lucena:** sugpo / shrimp, hipon, tahong, talaba and other seafood for dealers, wet markets and restaurants in Navotas, Valenzuela, Quezon City, Manila, Caloocan, Cavite, Laguna and Batangas.
- **Return / backhaul to Lucena:** red and white onion, garlic, ginger / luya and other produce. This cargo is either paid third-party freight, customer pickups or company-owned cargo.
- **Visayas / Mindanao:** served through port consolidation and shipping partners. The trucks never drive there.

Real-world coordination is manual today: Facebook Messenger, Viber and Messenger group chats (GCs), Facebook groups, phone calls, paper and memory. TradeLoop turns this into one operational system without forcing anyone off those channels.

---

# Product Scope

## Phase 1: logistics operations (the product)

```text
Lead → Quote → Logistics Job → Loads → Dispatch → Trip (stops) → Delivery → POD
     → Backhaul → Trip expenses & fuel → Invoice → Payment → Trip profitability
```

The **Load Board** feeds this loop from the side. Freight and truck-space posts from the GCs are logged there, matched against our trips, and booked as Logistics Jobs.

Phase 1 modules:

- **Overview:** Command Center, How It Works (`/workflow`)
- **Sales & CRM:** Leads, Customers, Quotes, Logistics Jobs
- **Logistics:** Dispatch, Trips, Deliveries, Loads / Cargo, Backhaul, Load Board
- **Fleet:** Trucks, Drivers, Maintenance, Fuel Logs, Vehicle Documents
- **Finance & Costs:** Receivables, Payments, Trip Expenses
- **Analytics:** Reports
- **Administration:** Settings
- **Other surfaces:** Driver view (`/driver`), printable Delivery Receipt / waybill (`/print/delivery-receipt/[deliveryId]`), Notifications, Future Modules (`/future/[slug]`)

## Phase 2 preview: trading

Product sales, catalog, inventory, procurement, purchase orders, suppliers, the trading dashboard and the customer ordering portal are **kept working** but are **not part of Phase 1**. They live under the collapsed **Trading · Phase 2 preview** sidebar group (`TRADING_NAV` in `lib/nav.ts`).

Rules:

- Trading never feeds trips or cargo. Backhaul produce is simply **company-owned cargo** on a trip.
- A purchase order may optionally add its pickup to a trip as company cargo. That is the only bridge between the two modules.
- Do not expand trading unless explicitly asked. Keep it compiling and consistent when shared data changes.

---

# Technology Stack

Actual versions (see `package.json`):

- Next.js 16 (App Router), React 19, TypeScript (strict)
- Tailwind CSS 4, shadcn-style primitives on `radix-ui`, `tw-animate-css`
- Lucide React icons
- Recharts 3
- TanStack Table 8
- React Hook Form + Zod 4 (`@hookform/resolvers`)
- Zustand 5 (single app store: a cache of the API's data set; only the cart and the owner's "preview as" role are kept in `localStorage`)
- date-fns 4, sonner (toasts), cmdk (global search), react-day-picker

Avoid new dependencies. Backend changes go in the API repo.

---

# Commands

```bash
npm run dev          # http://localhost:3000 (needs the API on TRADELOOP_API_URL, default :4000)
npm run build        # production build (type-checks)
npm run typecheck    # tsc --noEmit
```

In the API repo (`../../Nodejs backend/tradeloop-backend`):

```bash
npm run start:dev    # API on :4000 (Postgres + Redis from docker compose)
npm run seed         # demo organization "Lucena Fresh" + one login per desk (password DevPassword123!)
npm run domain:sync  # copy this repo's shared domain files into src/ops/domain (domain:check verifies)
npm run check:seed   # data volumes, trip utilization/profitability, AR aging, relationship checks
npm run check:flows  # runs the ops commands end to end on the demo data and asserts consistency
npm test && npm run test:e2e
```

After changing `types/index.ts`, `data/{areas,cargo,company,fleet,finance,tenant,products,suppliers}.ts` or `lib/{collections,ops-data,format,calc,selectors,logistics,load-board,backhaul-marketplace}.ts`, run `npm run domain:sync` in the API, then its `typecheck`, `check:seed`, `check:flows` and tests. Extend the API's `scripts/check-flows.ts` when you add a command that creates or links records.

---

# Engineering Principles

## 1. Prefer maintainability over cleverness

Avoid unnecessary abstractions, premature generic systems, deeply nested trees, extra context providers, giant components and duplicated business logic.

Prefer small composable components, domain feature modules, reusable primitives, clear types, deterministic mock data and centralized formatting.

## 2. Use domain-driven naming

Use the words dispatchers, drivers and accountants use: `LogisticsJob`, `Load`, `Trip`, `TripStop`, `Delivery`, `ProofOfDelivery`, `FreightQuote`, `Invoice`, `Payment`, `Expense`, `FuelLog`, `AvailableLoad`, `AvailableCapacity`, `TruckingPartner`.

Avoid vague names like `ItemData`, `Record`, `Entity`, `Info`, `Thing`.

## 3. Keep mock data relationally consistent

This is critical. Mock data must behave like a real operational database.

If `JOB-260925-009` rides `TRIP-260925-01`:

- the job's loads (`LOAD-…`) carry `tripId: "TRIP-260925-01"`
- the trip's stops load and unload those load IDs
- the trip detail lists the job, and the truck shows the trip as active
- the delivery (`DLV-260925-009`) references the job and trip
- the customer profile shows the job
- once delivered, the derived invoice (`INV-260925-009`) references the job
- recorded payments reduce that invoice's balance and the customer's receivable
- trip metrics (outbound/return kg, revenue, cost, contribution) include it

Never create disconnected dashboard numbers. Derive totals from the store.

## 4. Derive, don't store

Anything computable from records is a pure function, not stored state:

- invoices (`getInvoices`, derived from delivered/completed jobs + payments)
- trip metrics (`getTripMetricsMap`), trip stops (`planStops`), truck/driver status
- Load Board statuses (`loadStatus`), capacity views (`getCapacityViews`) and matches (`getBoardMatches`)

Heavy selectors are wrapped in `memoizeLast` and exposed through hooks in `hooks/use-data.ts` (`useInvoices`, `useTripMetrics`, `useCapacityViews`, `useBoardMatches`, …). Reuse them. Don't recompute in components.

---

# Data, API & Clock

- **Clock:** `TODAY`, `NOW`, `TOMORROW` in `data/company.ts` follow the API's operations clock (`setClock`, from every snapshot and command response). In development the API anchors it at the seed's "now", Fri Sep 25, 2026 7:48 AM (`OPS_CLOCK_ANCHOR`), and moves it two minutes per recorded event. Anchor all "today" logic to these; never use `new Date()` for business logic, and never read them at module level (they change after load).
- **Seed:** the API's `src/ops/seed` generates 30 days of trip history (Aug 26 → Sep 24), today's live operations, tomorrow's plan, the Load Board, the marketplace and the trading data. Deterministic. Owners of demo organizations reset it from the **Demo Data** badge (`resetDemo()` → `POST /ops/demo/reset`).
- **Store:** `lib/store.ts` holds the organization's whole data set (`OpsData`), loaded once from `GET /ops/snapshot`, kept current by polling `/ops/version`. Each action calls an API command and applies the returned change set (`applyOpsChanges` in `lib/ops-data.ts`). Actions are async; call them through `act()` (`lib/act.ts`) so refused commands toast the API's reason, and disable the submit button while the form is submitting.
- **Commands (API):** the workflow logic lives in the API (`src/ops/engine/commands.ts`): it stamps time with the operations clock, attributes events to the signed-in user, generates readable IDs with `nextSeqId`, pushes notifications, and enforces the business rules (editable trips, capacity, idempotent bookings, role and ownership checks). Add new workflows there plus an endpoint and DTO, then the store action here.
- **Tenant registries:** company profile, staff, helpers, trucks, drivers and revenue baselines come with the snapshot (`applyTenantProfile`). `truckById`, `staffById`, `COMPANY`… read them synchronously; screens render only after the data has loaded (the app shell shows a skeleton until then).
- **Session:** sign-in goes through `/api/session/*` (refresh token in an httpOnly cookie); browser API calls go to `/api/v1/*`, proxied to the API. Roles come from the membership; owners can preview other desks ("Preview as"). Drivers see only their own trips, customers only their own account.

---

# Project Structure

```text
app/
  (internal)/     thin route files for every internal module (incl. load-board, workflow, future/[slug])
  (public)/       customer ordering portal (trading storefront, Phase 2 preview) + /return-trips (public backhaul page)
  driver/         mobile driver view
  print/          printable delivery receipt / waybill
  login/          sign-in (lists the seeded demo accounts in development)
  api/session/    login / refresh / logout route handlers (refresh token in an httpOnly cookie)
components/
  ui/             shadcn-style primitives (button, badge, form-controls, overlays, primitives, table)
  layout/         app-shell (sidebar, nav badges, account menu / preview as), session-gate, global-search, notifications-bell, providers (session bootstrap + sync)
  shared/         PageHeader, KPICard, StatusBadge, TripCard, PodCard, ConfirmDialog, states, …
  data-table/     TanStack DataTable
  charts/         Recharts wrappers
  portal/         portal shell, product card, account gate (sign-in prompt)
features/<module>/  page-level views and dialogs (auth, jobs, trips, dispatch, load-board, backhaul, finance, fleet, …)
data/             reference data shared with the API, plus tenant registries
  company.ts      operations clock (setClock), PLATFORM, COMPANY / STAFF / HELPERS registries
  fleet.ts        TRUCKS / DRIVERS registries (truckById, driverById)
  finance.ts      revenue baseline registries
  tenant.ts       applyTenantProfile (fills the registries from the API)
  areas.ts        areas, places, route templates (RT-…)
  cargo.ts        cargo types, demo rate card (suggestFreight)
  products.ts, suppliers.ts  trading reference (Phase 2)
lib/
  logistics.ts    stop planning, trip metrics, billing, fleet status, customer stats
  load-board.ts   board statuses, capacity views, rule-based matching, share messages
  backhaul-marketplace.ts  listing views, request statuses, instant quotes, fit checks, shipper views
  ops-data.ts     OPS_COLLECTIONS, diffOpsData / applyOpsChanges (the API's change sets)
  collections.ts  memoizeLast, groupBy, sumBy (dependency-free, shared with the API)
  store.ts        Zustand store: API data cache + async actions (one per API command)
  session.ts      sign-in state; api/client.ts (fetch wrapper, ApiError), api/session-cookie.ts (server)
  act.ts          run an action and toast the API's reason when it is refused
  format.ts       peso, pesoCompact, kg, pct, num, date formatters, relativeDay
  domain.ts       domain label helpers (jobLane, tripRouteLine, …)
  nav.ts          sidebar NAV, TRADING_NAV, FUTURE_MODULES, ROLE_META, canAccess
  calc.ts, selectors.ts, portal.ts  trading math and portal helpers
  utils.ts        cn, copyText, downloadCsv (+ re-exports collections)
hooks/use-data.ts memoized derived-data hooks
types/index.ts    all domain types (logistics first, load board, finance, tenant, ops data & API contract, command inputs, then trading)
docs/             logistics-platform-benefits.md (owner business case), storefront-imagery.md
```

Route files stay thin: they render a `features/` view. Put domain logic in `lib/`, not in components.

---

# Domain Model

All types live in `types/index.ts`. Do not redeclare domain types elsewhere.

## Logistics

- **FreightQuote** (`QT-yymmdd-nnn`): Draft / Sent / Accepted / Rejected / Expired. An accepted quote converts to a job.
- **LogisticsJob** (`JOB-yymmdd-nnn`): the customer's shipment request. It holds pickup, drop-off, consignee, cargo, freight charge + additional charges, payment terms and `leg` (`outbound` leaves Lucena, `return` is hauled toward Quezon). Statuses: Inquiry → Quoted → Confirmed → Awaiting Dispatch → Assigned → In Transit → Delivered → Completed / Cancelled. Sources: Phone, Messenger, Facebook, Sales Staff, Repeat Customer, Referral, Customer Portal, **Load Board**. Load Board is set by the system only and hidden from the manual job form.
- **Load** (`LOAD-yymmdd-…`): gross weight against the van's configured payload. Types: Outbound, Backhaul, Third-Party, Company-Owned (no job).
- **Trip** (`TRIP-yymmdd-NN`): one truck movement on a route template (`RT-NV`, `RT-CAV`, `RT-SOU`, …). Statuses: Planned → Loading → Ready → Dispatched → In Transit → Returning → Completed / Cancelled. **Stops** are planned from the trip's loads (`planStops`) and keep actual times. A trip is editable while Planned / Loading / Ready. Return cargo can still be added while Dispatched / In Transit (`canAddReturnCargo`).
- **Delivery** (`DLV-…`, same suffix as the job): one per job dropped by a trip. It carries a **ProofOfDelivery** (DR no., signature, photos, damaged / short qty) and **DeliveryIssues**.
- **Invoice** (`INV-…`, same suffix as the job): derived for delivered/completed jobs. **Payment** (`PAY-yymmdd-nnn`) settles invoices.
- **Expense** (`EXP-…`), **FuelLog** (`FUEL-…`, each posts a Diesel expense), **MaintenanceRecord** (`MNT-…`), **VehicleDocument** (`DOC-…`).

**Trip contribution = freight revenue + additional charges − trip expenses.** Diesel is estimated until the fill-up is logged.

## Load Board

The Load Board is for freight and truck space shared in Messenger / Viber GCs, Facebook groups / posts and direct calls. The coordinator logs those posts here. It structures what already happens in the GCs; it does **not** replace those channels.

- **AvailableLoad** (`FRT-yymmdd-nnn`): cargo that needs a truck. Statuses: Looking for Truck, Matching, Reserved, Booked, Expired, Cancelled. The effective status comes from `loadStatus()`: once a job exists it follows the job, and an unbooked load expires 2 h past pickup.
- **AvailableCapacity** (`CAP-yymmdd-nnn`), a discriminated union on `fleet`:
  - `InternalCapacity`: a leg (`outbound` / `return`) of **our** trip. Capacity is **always read from the trip's loads** (configured payload − assigned kg on that leg). This keeps the board, the trip and Backhaul in agreement. Never store used kg for our own trucks.
  - `ExternalCapacity`: space on a partner's truck, using the figures they posted (`totalCapacityKg`, `usedCapacityKg`).
  - Statuses: Open, Partially Filled, Full, Departed, Expired, Cancelled. Open / Partially Filled / Full / Departed are derived unless the post was closed.
- **TruckingPartner** (`TP-nnn`): outside trucking businesses that post in the GCs.

Workflows (API commands, called through the store):

- `postBoardLoad`, `postCapacity`, `addTruckingPartner`
- `bookBoardLoad`: turns a post into a **LogisticsJob + Third-Party Load** (source `Load Board`). If the matched capacity is our trip, it is assigned to that trip, and return-leg cargo then shows on Backhaul. If no customer is picked, it creates a new customer from the poster. It is **idempotent**: re-booking never creates a second job or load, and at most moves the existing job onto a trip.
- `reserveOnPartnerTruck` / `setBoardLoadStatus`: reserving on a partner truck consumes its posted space once. Releasing the reservation gives the space back.
- `setCapacityStatus`, `updateCapacityUsed` (partner trucks only)

Matching (`matchLoad`) is a **fixed set of explainable rules**: pickup on route, destination direction, capacity, timing window, truck type, cargo restrictions. The SLEX / Maharlika corridor is handled explicitly. Results are labeled **Strong Match / Possible Match / Poor Fit**, and each check shows its reason. This is not route optimization and not machine learning; never describe it as either.

Share messages (`loadShareMessage`, `capacityShareMessage`) produce plain-text posts ("LOAD AVAILABLE" / "AVAILABLE TRUCK CAPACITY") that are copied back into the GCs. For our own or a customer's cargo, the contact is our dispatch desk.

**Load Board vs Backhaul:** the board holds offers that are **not yet on a trip**. Backhaul shows cargo **on** the return leg, and it links to the board where posted return legs have fitting loads. Trips with ≥ 1,000 kg of unposted return space are prompted for posting.

**Load Board vs Backhaul Marketplace:** the board is an internal coordination tool, with no public listing, bidding or payments between third parties. Keep it that way unless explicitly asked.

## Backhaul Marketplace (preview)

A working preview at `/future/backhaul-marketplace` (`FutureModule.preview` in `lib/nav.ts`; logic in `lib/backhaul-marketplace.ts`). It lists **our own** return legs only, for outside shippers. There is no online payment or bidding.

The shipper side is public at `/return-trips` (`features/portal/return-trips.tsx`, "Ship with us" in the portal nav). It is the only logistics page in the trading storefront; keep it framed as shipping, separate from product ordering.

- Browsing needs no login. Requesting asks only for business name, contact and a PH mobile number. Status checks use request number + mobile (`findShipperRequest`).
- Never show shippers plates, driver names, trip IDs, other cargo or exact truck times. Use `ShipperListingCard`, `fmtTimeWindow` and `checkRequest(…, { shipper: true })`.
- Dispatch confirms every request before it becomes a job.

- **BackhaulListing** (`BHL-yymmdd-nnn`): one per trip's return leg (₱/kg, minimum charge, accepted cargo). Open kg is read from the trip, never stored. Full / Departed are derived (`listingStatus`).
- **BackhaulBookingRequest** (`BKR-yymmdd-nnn`): instant quote via `marketplaceQuote`; effective status via `requestStatus`; fit via `checkRequest` (same `MatchCheck` rules vocabulary as the board).
- Actions: `publishBackhaulListing` (one listing per trip; re-publishing updates terms), `setBackhaulListingStatus`, `requestBackhaulSpace`, `confirmBackhaulRequest` (idempotent; creates a Job + Third-Party Load with source `Backhaul Marketplace` on the trip's return leg), `declineBackhaulRequest`.
- `Backhaul Marketplace` is a system-only job source (`SYSTEM_JOB_SOURCES`), hidden from the manual job form like `Load Board`.

## Customers, leads, roles

- **Customer** (`CUS-nnn`): contacts, delivery addresses, payment terms (COD, Credit 7/15/30 Days, 50% Down), credit limit, lead source, payment behavior.
- **Lead** (`LD-nnn`): pipeline New → Contacted → Quoted → Sample Order → Negotiating → Won / Lost. Supports convert to customer.
- **Roles:** owner, sales, dispatcher, procurement, warehouse, accounting, driver, customer. Each comes from the signed-in membership (API roles OWNER/ADMIN → owner, DISPATCHER/OPERATIONS_MANAGER/DRIVER_MANAGER → dispatcher, FINANCE → accounting, SALES, WAREHOUSE, PROCUREMENT, DRIVER, CUSTOMER; `APP_ROLE` in the API). Nav visibility and `canAccess` follow each nav item's `roles`; the API enforces what each role may change. Owners can preview other desks from the account menu. A DRIVER membership links to its driver (`subjectRef` DRV-…), a CUSTOMER one to its customer (CUS-…).

## Trading (Phase 2 preview)

Product, InventoryBatch, Order (`FR-yymmdd-nnn`), StandingOrder, Supplier (`SUP-…`), PurchaseOrder (`PO-…`), SalesPayment (`SP-…`), SalesInvoice, QuoteRequest, CartLine. Trading math is in `lib/calc.ts` / `lib/selectors.ts`.

---

# Screen Guidance

Priority screens get the most design attention:

1. **Command Center** (`/command-center`): the owner understands today's operation in under a minute. It shows jobs, trucks, trips in transit, deliveries, backhaul utilization, collections and alerts (unassigned jobs, late deliveries, capacity issues, overdue accounts, maintenance/document expiry, unused return capacity).
2. **Logistics Jobs** list, detail and create form. Manual channels (phone, Messenger, sales staff) are first-class. Job detail links its quote and, when applicable, its Load Board post.
3. **Dispatch** board: assign jobs to trips within configured payload.
4. **Trips** and **Trip Detail**: stops, loads, outbound + return utilization, expenses, revenue, cost, contribution.
5. **Deliveries** and POD, plus the printable DR / waybill.
6. **Backhaul**: return-leg utilization and unused kg, with links to the Load Board.
7. **Load Board** (`/load-board`, `?tab=capacity`, `?q=FRT-…`): Available loads and Truck capacity tabs, KPIs, filters (status, source, pickup, destination, date, truck type, internal/external, weight), match dialogs, a book dialog, a partners dialog and copy-to-GC share messages. The sidebar badge counts unbooked loads that still need a truck.
8. **Receivables** with aging (Current, 1–7, 8–30, 31–60, 60+ days) and payments.
9. **Customers** and **Customer Detail**: an operations-focused B2B CRM.
10. **How It Works** (`/workflow`): an interactive walkthrough of the 12-stage loop on real demo records. It deep-links with `?job=…&step=…`.
11. **Driver view**: intentionally simple. Current trip, truck, stops, consignee, contact, cargo, notes, Call / Mark Arrived / Upload POD / Mark Delivered. No financials.

Backhaul is the key differentiator. Always consider **outbound and return utilization**. A trip is not conceptually complete until its return load is accounted for. Useful figures: outbound %, return %, unused return kg, trip revenue, trip cost, trip contribution.

Example insights (simulated rules, stated plainly):

> Truck 01 has 3,200 kg unused return capacity.
>
> FRT-260925-001 → Truck 01 is a Strong Match: 1,200 kg left after.

---

# Philippine Localization

## Currency and formatting

Always use the centralized formatters in `lib/format.ts`. Never format by hand.

- `peso(n)` gives `₱12,500` (en-PH, PHP, no decimals). `peso(n, true)` includes centavos.
- `pesoCompact(n)` is for KPI tiles.
- `kg(n)` gives `2,000 kg`. `pct`, `num`, `fmtDate`, `fmtDay`, `fmtTime`, `fmtDateTime` and `relativeDay` cover the rest.

## Locations

- **Quezon / origin:** Lucena City, Sariaya, Tayabas, Pagbilao, Candelaria, Tiaong, Lucban
- **Metro Manila:** Navotas, Valenzuela, Quezon City, Manila, Caloocan, Pasay, Parañaque, Las Piñas, Muntinlupa
- **Cavite:** Bacoor, Imus, Dasmariñas, General Trias
- **Laguna:** Calamba, Santa Rosa, San Pablo
- **Batangas:** Batangas City, Lipa, Santo Tomas
- **Inter-island buyers:** Cebu City, Iloilo City, Bacolod, Davao City, Cagayan de Oro, General Santos City

Never show Visayas / Mindanao as direct truck routes. Represent them as: Lucena → Port / Cargo Consolidation → Shipping / Logistics Partner → Regional Distributor.

Areas, places and route templates live in `data/areas.ts`. Add places there rather than inline.

## Cargo, rates and prices

- Seafood: sugpo, hipon, tahong, talaba, alimango, bangus, tilapia. Produce: red / white onion, garlic, ginger / luya, tomato, potato. Cargo categories: Seafood, Shellfish, Produce, Dry Goods, General Cargo.
- Kilograms are the primary unit.
- Freight rates (`data/cargo.ts` rate card) and product prices are **demo / indicative**. Use `DemoRateNote` / `DemoPriceNote`. Never present them as live market rates.

## Demo businesses and people

Use realistic but **fictional** Philippine names. Examples: Navotas Prime Seafood Supply, RJM Seafood Trading, Seaside Grill Bacoor, Quezon Harvest Traders, Valenzuela Produce Depot, Southline Hauling Services (trucking partner). People: Joel Mendoza, Noel Pascual, Grace Lontoc, Rodel Samonte, and so on.

Use obviously fictional phone numbers. Never use real people, real companies' financial data or real identifiers.

## Fleet

| Truck | Make/Model | Type | Plate (fictional) | Configured payload |
| --- | --- | --- | --- | --- |
| Truck 01 (`TRK-01`) | Isuzu Giga | 10-Wheeler Closed Van | NCR 4821 | 8,500 kg |
| Truck 02 (`TRK-02`) | Hino 500 | 10-Wheeler Closed Van | NCR 6398 | 8,500 kg |

Capacity is the operator's configured payload for simulation, not a manufacturer limit. Partner trucks on the Load Board may be 4-, 6- or 10-wheelers, closed, wing or reefer vans.

---

# Core UX Principle

Support the channels the business already uses. Jobs and board posts originate from Messenger, Viber / Messenger GCs, Facebook, phone, sales staff, repeat customers, referrals and the portal. Everything feeds central job management. The platform helps the business migrate gradually; it does not force portal adoption.

---

# UI Design Rules

Feel: modern, professional, operational, data-rich without clutter, appropriate for Philippine SMEs.

Avoid: playful visuals, heavy gradients, glassmorphism, neon palettes, crypto-dashboard looks, marketing-size headings inside operations screens, excessive animation.

Favor: clean typography, clear hierarchy, subtle borders, strong tables, concise badges, readable tabular numbers.

## Status styling

Use `StatusBadge` from `components/shared/status-badge.tsx`. It maps status strings to tones and icons: muted (draft / inactive / departed), info (scheduled / pending / matching), warning (attention / looking for truck), success (confirmed / paid / delivered / booked), destructive (overdue / failed / cancelled), plus teal for reserved. Add new statuses to its `MAP` instead of styling inline. Never rely on color alone.

Related badges: `LoadTypeBadge`, `LegBadge`, `ReceivableBadge` (status-badge.tsx); `JobSourceBadge`, `BoardSourceBadge`, `SourceBadge` (common.tsx).

## Components to reuse

`PageHeader`, `KPICard`, `MoneyDisplay`, `CapacityBar`, `Timeline`, `AddressDisplay`, `EmptyState`, `FilterBar`, `FilterSelect`, `Stat`, `SectionTitle`, `LineItem`, `DemoRateNote` / `DemoPriceNote` (`components/shared/common.tsx`); `TripCard`, `TruckStatusCard` (trip-card.tsx); `PodCard` (pod.tsx); `ConfirmDialog`; `PageSkeleton`, `RecordNotFound` (states.tsx); `DataTable` (`components/data-table`); chart wrappers (`components/charts`).

Do not build one-off versions of these patterns.

## Tables

Use `DataTable` (TanStack) with sortable columns, useful filters (`FilterBar` + `FilterSelect`), search (`searchText`), pagination, responsive overflow and row actions. On small screens, use cards when a table becomes unusable.

## Charts

Use Recharts through `components/charts`. Every chart answers an operational question: revenue trend, revenue by route, truck utilization, outbound vs return utilization, receivables aging, customer concentration. No decorative charts.

---

# Forms

React Hook Form + Zod. They need labels (never placeholder-only), validation messages, disabled / loading states, a success toast (sonner), clear submit actions and meaningful defaults drawn from the demo clock and related records.

# Accessibility

Semantic HTML, keyboard-accessible controls, visible focus, labeled inputs, `sr-only` headers for icon-only action columns, sufficient contrast and `aria-*` where needed.

# Loading / Empty / Error States

Every major page handles loading (`app/(internal)/loading.tsx`, `PageSkeleton`), empty (`EmptyState` with specific copy such as "No loads waiting for a truck." or "No trips scheduled today."), not found (`RecordNotFound`) and errors (`app/(internal)/error.tsx`).

# Responsive

- **Desktop:** owner, accounting, dispatcher, sales.
- **Tablet:** warehouse, dispatch, manager review.
- **Mobile:** owner quick monitoring, sales, drivers, customers.

---

# Money and Business Metrics

Be precise: Revenue, Freight Charge, Additional Charges, Trip Cost, Contribution, Gross Margin, Outstanding Balance, Average Job Value. Never call revenue "profit". Never call contribution "net income".

Centralize calculations in `lib/logistics.ts` (e.g. `jobTotal`, `getTripMetricsMap`, `getInvoices`, `getCustomerStats`) and `lib/load-board.ts`. Trading calculations go in `lib/calc.ts`. Never duplicate them in components.

---

# Future Modules

Shown under `/future/[slug]` (`FUTURE_MODULES` in `lib/nav.ts`), visually separate from Phase 1: Marketplace, Supplier Bidding, Backhaul Marketplace, Live GPS, Temperature Monitoring, Route Optimization, AI Demand Forecasting, Price Intelligence, Inter-Island Logistics, API Integrations.

Do not implement them unless explicitly requested. Backhaul Marketplace is the one with a working preview. Truck location today comes from the latest stop update, not GPS.

# Avoid Scope Creep

Before adding a feature, ask whether it improves bookings / jobs, dispatch and trips, backhaul utilization, fleet upkeep, trip costs, collections or owner visibility. If none apply, it probably does not belong in Phase 1.

---

# Code Quality Expectations

1. Inspect existing patterns before introducing new ones.
2. Reuse existing components, hooks and selectors.
3. Keep all domain types in `types/index.ts`, and don't duplicate them.
4. No `any`. Keep TypeScript strict.
5. Keep imports clean. Delete unused code. No commented-out experiments.
6. Keep client components to areas that need client behavior.
7. No unnecessary dependencies.
8. Maintain responsive behavior.
9. After changing seed data, commands or shared domain files, verify related pages and run the API's check scripts.
10. Don't leave throwaway scripts in either repo.

# Before Completing a Task

1. Understand the affected workflow and related entities.
2. Reuse existing data relationships. New records must link both ways.
3. Implement the UI with loading / empty / error states.
4. Verify responsive layout.
5. Run `npm run typecheck` here; when shared domain files or commands changed, run `domain:sync`, `typecheck`, `check:seed`, `check:flows` and the tests in the API.
6. Check related entity references (job ↔ loads ↔ trip ↔ delivery ↔ invoice ↔ payment ↔ customer ↔ board post).
7. Check for unrealistic Philippine demo data.
8. Confirm the workflow still reflects real logistics operations.
9. Update `README.md` (routes, data model) when adding modules or entities.

---

# Important Product Decisions

- **Logistics first.** Phase 1 is a logistics operations system. Trading is a Phase 2 preview that never feeds trips.
- **Don't force portal adoption.** Manual channels stay first-class.
- **Structure the GCs, don't replace them.** The Load Board logs and matches GC posts and copies share messages back out.
- **Protect the backhaul concept.** Every truck comes home to Lucena; fill the return leg.
- **Keep rules explainable.** Stop planning, backhaul suggestions and board matching are simple rules with visible reasons, never "AI".
- **Owner visibility.** The owner should quickly see what was booked, what is pending, what is moving, where trucks are, unused capacity, who owes money, and expected revenue / cost / contribution.

# Definition of Done

A feature is done when it fits the domain, uses realistic fictional PH data, connects to related records, supports common states, works responsively, matches existing patterns, uses accurate business terms, gives useful operational information and passes the check scripts, without adding unnecessary complexity.

# Product North Star

```text
Messenger + Viber GCs + Facebook + Phone Calls + Paper + Memory
```

into:

```text
Lead / Load Board post → Quote → Job → Loads → Dispatch → Trip → Delivery & POD
→ Backhaul → Costs → Invoice → Collection → Trip profitability
```

TradeLoop should feel like a credible operating system for a Philippine trucking, trading and logistics business, not a generic admin template.
