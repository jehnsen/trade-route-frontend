# TradeLoop — Logistics Operations for Lucena Fresh Trading & Logistics

Frontend demo of TradeLoop for **Lucena Fresh Trading & Logistics** (Lucena City, Quezon), an operator running two 10-wheeler closed vans from Lucena to Metro Manila and CALABARZON.

Phase 1 is a **logistics operations system**:

```
Lead → Quote → Logistics Job → Loads → Dispatch → Trip (stops) → Delivery → POD
     → Backhaul → Trip expenses & fuel → Invoice → Payment → Trip profitability
```

The **Load Board** feeds the loop from the side: loads and truck space posted in Messenger / Viber GCs, Facebook groups and direct calls are logged in one place, matched against our trips with explainable rules, and booked as Logistics Jobs.

No backend. All data is fictional, generated deterministically, and stored client-side (Zustand, persisted to `localStorage`). The demo clock is fixed at **Fri, Sep 25, 2026 · 7:48 AM**.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (type-checks)
npm run typecheck
npm run check:seed   # data volume, utilization, AR aging + relationship checks on the logistics seed
npm run check:flows  # exercises store actions (assign, POD, payments, quotes, trips, load board) and checks consistency
```

## Where to look

| Area | Routes |
| --- | --- |
| Owner | `/command-center`, `/reports`, `/workflow` (interactive walkthrough of the loop; deep-link with `?job=…&step=…`) |
| Sales & CRM | `/leads`, `/customers`, `/customers/[id]`, `/quotes`, `/jobs`, `/jobs/new`, `/jobs/[id]` |
| Logistics | `/dispatch`, `/trips`, `/trips/[id]`, `/deliveries`, `/deliveries/[id]`, `/loads`, `/backhaul`, `/load-board` (`?tab=capacity`, `?q=FRT-…`) |
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

## Load Board

The board structures what already happens in the trucking GCs. It does not replace them, and it is not a public marketplace.

- **AvailableLoad** (`FRT-yymmdd-nnn`): cargo that needs a truck, with pickup, destination, weight, required truck type, pickup / deliver-by times and offered freight. Statuses: Looking for Truck, Matching, Reserved, Booked, Expired, Cancelled. Once a job exists, the status follows the job. An unbooked load expires 2 hours past pickup.
- **AvailableCapacity** (`CAP-yymmdd-nnn`) comes in two kinds:
  - **Internal:** a leg of one of our trips. Its free kg is always read from the trip's loads, so the board, the trip and Backhaul agree.
  - **External:** a partner truck's posted space.
- **TruckingPartner** (`TP-nnn`): outside haulers who post in the GCs.
- **Matching** is rule-based and explained per check: pickup on route, direction, capacity, timing, truck type and cargo restrictions. Each pair is labeled Strong Match, Possible Match or Poor Fit. It is not route optimization or ML.
- **Booking** a load creates a **Logistics Job + Third-Party Load** (source *Load Board*). When matched to our trip, it is assigned straight onto that trip, and return-leg cargo shows on Backhaul. An unknown shipper becomes a new customer. Re-booking never duplicates the job or load.
- Loads can instead be **reserved on a partner truck**, which holds that truck's space until the reservation is released.
- **Share messages** ("LOAD AVAILABLE" / "AVAILABLE TRUCK CAPACITY") copy to the clipboard for reposting in the GCs.
- Backhaul links to the board when posted return legs have fitting loads. The board prompts to post trips with ≥ 1,000 kg of unposted return space. The sidebar badge counts loads still needing a truck.

## Structure

- `types/` — domain types (logistics first, trading types below)
- `data/` — reference data (customers, fleet & documents, areas/places/routes, cargo types & demo rate card, leads), `load-board.ts` (trucking partners, board posts), `logistics-seed.ts` (logistics generator), `seed.ts` (trading generator)
- `lib/` — `logistics.ts` (stop planning, trip metrics, billing, fleet status), `load-board.ts` (board statuses, capacity views, matching, share messages), `store.ts` (Zustand actions), `calc.ts` / `selectors.ts` (trading math), `format.ts`, `nav.ts`, `domain.ts`
- `hooks/use-data.ts` — memoized derived data (invoices, trip metrics, customer stats, board capacity views and matches)
- `components/ui` — shadcn-style primitives; `components/shared` — PageHeader, KPICard, StatusBadge, LoadTypeBadge, JobSourceBadge, BoardSourceBadge, Timeline, CapacityBar, TripCard, TruckStatusCard, PodCard…; `components/data-table`, `components/charts`
- `features/<module>/` — page-level views; `app/(internal)`, `app/(public)`, `app/driver`, `app/print` — thin route files
- `scripts/` — `check-seed.ts`, `check-flows.ts`

Contributor and AI-assistant conventions (domain rules, data consistency, UI patterns, definition of done) are in [CLAUDE.md](CLAUDE.md).
