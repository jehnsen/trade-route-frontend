# FreshRoute — Wholesale Trading & Logistics, Connected.

Frontend demo of FreshRoute for **Lucena Fresh Trading & Logistics** (Lucena City, Quezon): orders from Messenger, phone, Facebook, sales staff and the customer portal flow into one system → inventory → dispatch → deliveries → backhaul procurement → collections → reports.

No backend. All data is fictional, generated deterministically in `data/seed.ts`, and stored client-side (Zustand, persisted to `localStorage`). The demo clock is fixed at **Fri, Sep 25, 2026 · 7:48 AM**.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (type-checks)
npm run check:seed   # prints data-volume, utilization and AR stats
npm run check:flows  # verifies cross-entity consistency of store actions
```

## Where to look

| Area | Routes |
| --- | --- |
| Owner | `/command-center`, `/dashboard`, `/reports` |
| Sales & CRM | `/orders`, `/orders/new`, `/orders/[id]`, `/customers`, `/customers/[id]`, `/leads` |
| Logistics | `/dispatch`, `/trips`, `/trips/[id]`, `/deliveries`, `/backhaul`, `/trucks`, `/drivers` |
| Stock & purchasing | `/catalog` (internal products), `/inventory`, `/procurement`, `/purchase-orders`, `/suppliers` |
| Finance | `/accounts-receivable`, `/payments`, `/expenses` |
| Customer portal | `/`, `/products`, `/products/[slug]`, `/order`, `/request-quote`, `/my-orders`, `/account`, `/contact` |
| Driver (mobile) | `/driver` |
| Print | `/print/delivery-receipt/[orderId]` |

The internal product catalog lives at `/catalog` because `/products` is the public catalog.

Use the account switcher in the header to preview roles (Owner, Sales, Dispatcher, Procurement, Warehouse, Accounting, Driver, Customer). The **Demo Data** badge resets everything.

## Structure

- `types/` — domain types
- `data/` — reference data (customers, suppliers, products, fleet, routes, leads) and the seed generator
- `lib/` — `calc.ts` (order/invoice math), `selectors.ts` (derived metrics), `store.ts` (Zustand actions), `format.ts`, `nav.ts`, `portal.ts`
- `components/ui` — shadcn-style primitives; `components/shared` — PageHeader, KPICard, StatusBadge, Timeline, CapacityBar, TripCard…; `components/data-table`, `components/charts`
- `features/<module>/` — page-level views; `app/(internal)`, `app/(public)`, `app/driver` — thin route files
