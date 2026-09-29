# CLAUDE.md

## Project Overview

**TradeLoop** (repo: `trade-route-frontend`) is a logistics operations platform for Philippine seafood and agricultural trading/logistics businesses. It is a **frontend demo / prototype**: no backend, realistic structured mock data.

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
- Zustand 5 (single app store, persisted to `localStorage`)
- date-fns 4, sonner (toasts), cmdk (global search), react-day-picker

Do not add a backend unless explicitly requested. Avoid new dependencies.

---

# Commands

```bash
npm run dev          # http://localhost:3000
npm run build        # production build (type-checks)
npm run typecheck    # tsc --noEmit
npm run check:seed   # data volumes, trip utilization/profitability, AR aging, relationship checks
npm run check:flows  # exercises store actions end-to-end and asserts consistency
```

`check:flows` covers assigning jobs to trips, POD, payments, quotes, trips and the Load Board. It prints "storage is currently unavailable" warnings from the zustand persist middleware under Node. Those warnings are expected and harmless.

After changing the seed, the store or `lib/logistics.ts` / `lib/load-board.ts`, run `typecheck`, `check:seed` and `check:flows`. Extend `scripts/check-flows.ts` when you add a store action that creates or links records.

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

# Demo State & Clock

- **Demo clock:** `TODAY = "2026-09-25"`, `NOW = "2026-09-25T07:48"`, `TOMORROW = "2026-09-26"` in `data/company.ts`. Anchor all "today" logic to these. Never use `new Date()` for business logic.
- **Seed:** `data/logistics-seed.ts` generates 30 days of trip history (Aug 26 → Sep 24), today's live operations and tomorrow's plan. It is deterministic. `data/seed.ts` generates the trading data.
- **Store:** `lib/store.ts` is one Zustand store holding all records and actions. It is persisted as `tradeloop-logistics-demo-v2`. New slices added to `initialData()` and `partialize` pick up seed data in existing browsers through the default shallow merge. Bump the storage `name`/`version` only when a seed change is incompatible with previously persisted data.
- **Reset:** the **Demo Data** badge calls `resetDemo()`.
- **Actions:** actions stamp time with the demo clock (`stamp()`), attribute to the current role (`actor()`), generate IDs with `nextSeqId`, and push `notify(...)` notifications where relevant. Follow that pattern.

---

# Project Structure

```text
app/
  (internal)/     thin route files for every internal module (incl. load-board, workflow, future/[slug])
  (public)/       customer ordering portal (trading storefront, Phase 2 preview)
  driver/         mobile driver view
  print/          printable delivery receipt / waybill
components/
  ui/             shadcn-style primitives (button, badge, form-controls, overlays, primitives, table)
  layout/         app-shell (sidebar, nav badges, role switcher), global-search, notifications-bell, providers
  shared/         PageHeader, KPICard, StatusBadge, TripCard, PodCard, ConfirmDialog, states, …
  data-table/     TanStack DataTable
  charts/         Recharts wrappers
  portal/         portal shell + product card
features/<module>/  page-level views and dialogs (jobs, trips, dispatch, load-board, backhaul, finance, fleet, …)
data/             reference data + generators
  company.ts      demo clock, company, staff, helpers
  areas.ts        areas, places, route templates (RT-…)
  cargo.ts        cargo types, demo rate card (suggestFreight)
  customers.ts, leads.ts, fleet.ts (trucks, drivers, vehicle documents), finance.ts
  logistics-seed.ts  logistics generator
  load-board.ts   trucking partners, board loads, board capacity
  seed.ts, products.ts, suppliers.ts, orders.ts, procurement.ts  trading (Phase 2)
lib/
  logistics.ts    stop planning, trip metrics, billing, fleet status, customer stats
  load-board.ts   board statuses, capacity views, rule-based matching, share messages
  store.ts        Zustand store + actions
  format.ts       peso, pesoCompact, kg, pct, num, date formatters, relativeDay
  domain.ts       domain label helpers (jobLane, tripRouteLine, …)
  nav.ts          sidebar NAV, TRADING_NAV, FUTURE_MODULES, ROLE_META, canAccess
  calc.ts, selectors.ts, portal.ts  trading math and portal helpers
  utils.ts        cn, memoizeLast, groupBy, sumBy, copyText, downloadCsv
hooks/use-data.ts memoized derived-data hooks
types/index.ts    all domain types (logistics first, load board, finance, then trading)
scripts/          check-seed.ts, check-flows.ts
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

Workflows (store actions):

- `postBoardLoad`, `postCapacity`, `addTruckingPartner`
- `bookBoardLoad`: turns a post into a **LogisticsJob + Third-Party Load** (source `Load Board`). If the matched capacity is our trip, it is assigned to that trip, and return-leg cargo then shows on Backhaul. If no customer is picked, it creates a new customer from the poster. It is **idempotent**: re-booking never creates a second job or load, and at most moves the existing job onto a trip.
- `reserveOnPartnerTruck` / `setBoardLoadStatus`: reserving on a partner truck consumes its posted space once. Releasing the reservation gives the space back.
- `setCapacityStatus`, `updateCapacityUsed` (partner trucks only)

Matching (`matchLoad`) is a **fixed set of explainable rules**: pickup on route, destination direction, capacity, timing window, truck type, cargo restrictions. The SLEX / Maharlika corridor is handled explicitly. Results are labeled **Strong Match / Possible Match / Poor Fit**, and each check shows its reason. This is not route optimization and not machine learning; never describe it as either.

Share messages (`loadShareMessage`, `capacityShareMessage`) produce plain-text posts ("LOAD AVAILABLE" / "AVAILABLE TRUCK CAPACITY") that are copied back into the GCs. For our own or a customer's cargo, the contact is our dispatch desk.

**Load Board vs Backhaul:** the board holds offers that are **not yet on a trip**. Backhaul shows cargo **on** the return leg, and it links to the board where posted return legs have fitting loads. Trips with ≥ 1,000 kg of unposted return space are prompted for posting.

**Load Board vs "Backhaul Marketplace" (future module):** the board is an internal coordination tool, with no public listing, bidding or payments between third parties. Keep it that way unless explicitly asked.

## Customers, leads, roles

- **Customer** (`CUS-nnn`): contacts, delivery addresses, payment terms (COD, Credit 7/15/30 Days, 50% Down), credit limit, lead source, payment behavior.
- **Lead** (`LD-nnn`): pipeline New → Contacted → Quoted → Sample Order → Negotiating → Won / Lost. Supports convert to customer.
- **Roles:** owner, sales, dispatcher, procurement, warehouse, accounting, driver, customer. They are switched from the header account menu (`ROLE_META` in `lib/nav.ts`). Nav visibility and `canAccess` follow each nav item's `roles`. This is demo-level behavior only.

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

Do not implement them unless explicitly requested. Truck location today comes from the latest stop update, not GPS.

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
9. After changing shared mock data or store actions, verify related pages and run the check scripts.
10. Don't leave throwaway scripts (e.g. `scripts/_probe.ts`) in the repo.

# Before Completing a Task

1. Understand the affected workflow and related entities.
2. Reuse existing data relationships. New records must link both ways.
3. Implement the UI with loading / empty / error states.
4. Verify responsive layout.
5. Run `npm run typecheck`, `npm run check:seed` and `npm run check:flows`.
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
