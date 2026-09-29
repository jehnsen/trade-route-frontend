# TradeLoop — Logistics Operations for Lucena Fresh Trading & Logistics

Frontend demo of TradeLoop for **Lucena Fresh Trading & Logistics** (Lucena City, Quezon), an operator running two 10-wheeler closed vans from Lucena to Metro Manila and CALABARZON.

Phase 1 is a **logistics operations system**:

```
Lead → Quote → Logistics Job → Loads → Dispatch → Trip (stops) → Delivery → POD
     → Backhaul → Trip expenses & fuel → Invoice → Payment → Trip profitability
```

No backend. All data is fictional, generated deterministically, and stored client-side (Zustand, persisted to `localStorage`). The demo clock is fixed at **Fri, Sep 25, 2026 · 7:48 AM**.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (type-checks)
npm run typecheck
npm run check:seed   # data volume, utilization, AR aging + relationship checks on the logistics seed
npm run check:flows  # exercises store actions (assign, POD, payments, quotes, trips) and checks consistency
```

## Where to look

| Area | Routes |
| --- | --- |
| Owner | `/command-center`, `/reports`, `/workflow` (interactive walkthrough of the loop; deep-link with `?job=…&step=…`) |
| Sales & CRM | `/leads`, `/customers`, `/customers/[id]`, `/quotes`, `/jobs`, `/jobs/new`, `/jobs/[id]` |
| Logistics | `/dispatch`, `/trips`, `/trips/[id]`, `/deliveries`, `/deliveries/[id]`, `/loads`, `/backhaul` |
| Fleet | `/trucks`, `/trucks/[id]`, `/drivers`, `/drivers/[id]`, `/maintenance`, `/fuel-logs`, `/documents` |
| Finance & Costs | `/accounts-receivable`, `/accounts-receivable/[invoiceId]`, `/payments`, `/expenses` (trip expenses) |
| Driver (mobile) | `/driver` |
| Print | `/print/delivery-receipt/[deliveryId]` (DR / waybill) |
| Trading — Phase 2 preview | `/orders`, `/dashboard`, `/catalog`, `/inventory`, `/procurement`, `/purchase-orders`, `/suppliers` |
| Customer portal (trading storefront) | `/`, `/products`, `/order`, `/request-quote`, `/my-orders`, `/account`, `/contact` |

The trading module (product sales, stock, purchasing) is kept working under a collapsed **Trading · Phase 2 preview** sidebar group. It never feeds trips or cargo: backhaul produce is simply **company-owned cargo** on a trip. A purchase order can optionally add its pickup to a trip as company cargo.

Use the account switcher in the header to preview roles (Owner, Sales, Dispatcher, Procurement, Warehouse, Accounting, Driver, Customer). The **Demo Data** badge resets everything.

Business case for owners and stakeholders: [docs/logistics-platform-benefits.md](docs/logistics-platform-benefits.md).

## Data model (logistics)

- **FreightQuote** (`QT-…`) → accepted quote converts to a **LogisticsJob** (`JOB-yymmdd-nnn`), the customer's shipment request (pickup, drop-off, consignee, cargo, freight + additional charges, terms).
- Each job has one or more **Loads** (`LOAD-…`) — gross weight against the van's configured payload. Load types: Outbound, Backhaul, Third-Party, Company-Owned (no job).
- A **Trip** (`TRIP-yymmdd-NN`) is the truck movement; its **stops** are planned from its loads (`planStops` in `lib/logistics.ts`) and keep actual times.
- One **Delivery** (`DLV-…`) per job dropped by a trip, with **POD** (DR no., signature, photos, damaged/short) and issues.
- Delivered jobs produce freight **Invoices** (`INV-…`, derived); **Payments** (`PAY-…`) settle them.
- **Expenses**, **FuelLogs** (each posts a Diesel expense), **MaintenanceRecords**, **VehicleDocuments**.

Trip contribution = freight revenue + additional charges − trip expenses (diesel is estimated until the fill-up is logged).

## Structure

- `types/` — domain types (logistics first, trading types below)
- `data/` — reference data (customers, fleet & documents, areas/places/routes, cargo types & demo rate card, leads), `logistics-seed.ts` (logistics generator), `seed.ts` (trading generator)
- `lib/` — `logistics.ts` (stop planning, trip metrics, billing, fleet status), `store.ts` (Zustand actions), `calc.ts` / `selectors.ts` (trading math), `format.ts`, `nav.ts`, `domain.ts`
- `components/ui` — shadcn-style primitives; `components/shared` — PageHeader, KPICard, StatusBadge, LoadTypeBadge, Timeline, CapacityBar, TripCard, TruckStatusCard, PodCard…; `components/data-table`, `components/charts`
- `features/<module>/` — page-level views; `app/(internal)`, `app/(public)`, `app/driver`, `app/print` — thin route files
