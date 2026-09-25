# CLAUDE.md

## Project Overview

**TradeRoute** is a modern B2B wholesale trading, distribution, procurement, and logistics operations platform designed for Philippine seafood and agricultural trading businesses.

The initial design partner is a trading/logistics operation based in **Lucena City, Quezon Province** with two 10-wheeler closed vans.

Typical operations:

- Outbound from Lucena:
  - Sugpo / shrimp
  - Hipon
  - Tahong
  - Talaba
  - Other seafood and wet-market products
- Common delivery destinations:
  - Navotas
  - Valenzuela
  - Quezon City
  - Manila
  - Caloocan
  - Cavite
  - Laguna
  - Batangas
  - Other nearby Metro Manila / CALABARZON locations
- Return / backhaul:
  - Red onion
  - White onion
  - Garlic
  - Ginger / luya
  - Other agricultural produce
- Goods procured during the return trip are distributed to vendors, restaurants, retailers, and traders around Lucena and Quezon Province.
- Larger orders may also be supplied to customers in Visayas and Mindanao through logistics partners or inter-island shipping.

Current real-world operations are largely manual:

- Facebook Messenger
- phone calls
- Facebook groups
- referrals
- manually coordinated orders
- manually coordinated truck assignments
- manually tracked customer balances
- manually coordinated procurement and return loads

TradeRoute digitizes these workflows into one operational system.

---

# Product Positioning

TradeRoute is **not just an ordering website**.

It is a:

> **Wholesale Trade & Logistics Operating System**

Primary modules:

- CRM
- Leads
- Orders
- Product Catalog
- Inventory
- Dispatch
- Deliveries
- Trips
- Fleet
- Procurement
- Purchase Orders
- Suppliers
- Backhaul
- Accounts Receivable
- Payments
- Expenses
- Analytics
- Customer Ordering Portal

Core business flow:

```text
Lead
→ Customer
→ Order
→ Inventory Reservation
→ Dispatch
→ Trip
→ Delivery
→ Procurement
→ Backhaul
→ Return to Lucena
→ Collection
→ Reporting
```

---

# Technology Stack

Use:

- Next.js latest stable
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Recharts
- TanStack Table
- React Hook Form
- Zod
- Zustand when lightweight client state is needed
- date-fns

Do not add a backend unless explicitly requested.

The current application is a **frontend demo / prototype** using realistic structured mock data.

---

# Engineering Principles

## 1. Prefer maintainability over cleverness

Use straightforward, readable patterns.

Avoid:

- unnecessary abstractions
- premature generic systems
- deeply nested component trees
- excessive context providers
- overly complex state management
- giant components
- duplicated business logic

Prefer:

- small composable components
- domain-specific feature modules
- reusable primitives
- clear types
- deterministic mock data
- centralized formatting utilities

---

## 2. Use domain-driven naming

Prefer business terms used by actual wholesale/logistics staff.

Good:

- `Order`
- `Trip`
- `TripStop`
- `Delivery`
- `PurchaseOrder`
- `Supplier`
- `InventoryBatch`
- `Receivable`
- `BackhaulLoad`
- `Customer`
- `StandingOrder`

Avoid vague naming such as:

- `ItemData`
- `Record`
- `Entity`
- `Info`
- `Thing`
- `DataObject`

---

## 3. Keep mock data relationally consistent

This is critical.

Mock data must behave like a real operational database.

Example:

If:

```text
Order FR-260925-001
```

is assigned to:

```text
TRIP-260925-01
```

then:

- the order detail must reference `TRIP-260925-01`
- the trip detail must include `FR-260925-001`
- the truck assigned to the trip must show the same active trip
- the customer profile must show the order
- the related invoice must reference the order
- recorded payments must reduce the correct receivable
- inventory reservations must reflect the products in the order

Never create random disconnected dashboard numbers.

Derive totals from the structured mock dataset whenever practical.

---

# Suggested Project Structure

```text
app/
  (internal)/
    dashboard/
    command-center/
    orders/
    customers/
    products/
    inventory/
    deliveries/
    trips/
    dispatch/
    procurement/
    purchase-orders/
    suppliers/
    backhaul/
    accounts-receivable/
    payments/
    expenses/
    trucks/
    drivers/
    leads/
    reports/
    settings/

  (public)/
    page.tsx
    products/
    order/
    request-quote/
    my-orders/
    account/
    contact/

  driver/

components/
  ui/
  layout/
  charts/
  data-table/
  forms/
  shared/

features/
  orders/
  customers/
  trips/
  dispatch/
  procurement/
  inventory/
  finance/
  fleet/
  leads/
  public-ordering/

data/
  customers.ts
  suppliers.ts
  products.ts
  orders.ts
  trips.ts
  trucks.ts
  drivers.ts
  inventory.ts
  purchase-orders.ts
  invoices.ts
  payments.ts
  leads.ts

lib/
  currency.ts
  dates.ts
  calculations.ts
  mock-selectors.ts
  utils.ts

types/
  domain.ts

hooks/
```

Do not rigidly follow this structure if the existing repository already has a clean structure. Prefer improving the existing architecture rather than performing unnecessary rewrites.

---

# Core Domain Types

Define strong TypeScript models.

At minimum:

```ts
type CustomerType =
  | "palengke_vendor"
  | "restaurant"
  | "hotel"
  | "resort"
  | "seafood_dealer"
  | "distributor"
  | "retailer"
  | "grocery"
  | "catering";

type OrderSource =
  | "customer_portal"
  | "facebook_messenger"
  | "phone"
  | "facebook_lead"
  | "salesperson"
  | "repeat_order";

type OrderStatus =
  | "draft"
  | "pending_confirmation"
  | "confirmed"
  | "preparing"
  | "ready_for_dispatch"
  | "out_for_delivery"
  | "delivered"
  | "partially_delivered"
  | "cancelled";

type PaymentStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "credit";

type DeliveryStatus =
  | "scheduled"
  | "loading"
  | "ready"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "failed"
  | "returned";

type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "ready_for_pickup"
  | "picked_up"
  | "partially_received"
  | "received"
  | "cancelled";
```

Important entities:

```ts
Customer
CustomerContact
CustomerAddress
Product
InventoryBatch
Order
OrderItem
StandingOrder
Delivery
Trip
TripStop
TripExpense
Truck
Driver
Supplier
SupplierQuote
PurchaseOrder
PurchaseOrderItem
Invoice
Payment
Receivable
Lead
BackhaulLoad
Notification
```

---

# Philippine Localization

The UI must feel genuinely Philippine.

## Currency

Always display Philippine pesos.

Use:

```text
₱12,500
₱84,320
₱1,284,500
```

Create a reusable formatter rather than manually formatting amounts.

Example:

```ts
export function formatPHP(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}
```

---

# Philippine Locations

Use realistic locations relevant to the operation.

## Quezon / Origin Region

- Lucena City
- Sariaya
- Tayabas
- Pagbilao
- Candelaria
- Tiaong
- Lucban

## Metro Manila

- Navotas City
- Valenzuela City
- Quezon City
- Manila
- Caloocan
- Pasay
- Parañaque
- Las Piñas
- Muntinlupa

## Nearby provinces

### Cavite

- Bacoor
- Imus
- Dasmariñas
- General Trias

### Laguna

- Calamba
- Santa Rosa
- San Pablo

### Batangas

- Batangas City
- Lipa
- Santo Tomas

## Inter-island demo buyers

- Cebu City
- Iloilo City
- Bacolod
- Davao City
- Cagayan de Oro
- General Santos City

Important:

Do not represent Visayas or Mindanao deliveries as direct truck routes from Lucena.

Represent them as something like:

```text
Lucena
→ Port / Cargo Consolidation
→ Shipping / Logistics Partner
→ Regional Distributor
```

---

# Product Catalog

Use realistic seafood and agricultural products.

## Seafood

- Sugpo / Tiger Prawn
- Hipon
- Tahong
- Talaba
- Alimango
- Bangus
- Tilapia

## Agricultural Produce

- Red Onion
- White Onion
- Garlic
- Ginger / Luya
- Tomato
- Potato

Use kilograms as the primary unit unless another unit is contextually appropriate.

Mock wholesale prices should be believable but clearly demo-only.

Example ranges:

```text
Sugpo: ₱380–₱520/kg
Tahong: ₱90–₱150/kg
Talaba: ₱100–₱180/kg
Red Onion: ₱70–₱130/kg
Garlic: ₱110–₱180/kg
Ginger: ₱90–₱160/kg
```

Never present mock prices as live market prices.

Where useful, display:

> Demo price / indicative price

---

# Demo Business Names

Use realistic but fictional Philippine business names.

Examples:

- Navotas Prime Seafood Supply
- Aling Nena Seafood Stall
- Maribel Wet Market Trading
- Seaside Grill Bacoor
- Batangas Bay Restaurant
- Lucena Public Market Trading
- Quezon Harvest Traders
- South Luzon Food Distribution
- RJM Seafood Trading
- Rosa's Ihaw-Ihaw

Supplier examples:

- Quezon Coastal Seafood Cooperative
- Tayabas Aquaculture Supply
- Valenzuela Produce Depot
- Divisoria Agri Trading
- North Metro Agricultural Supply
- Batangas Vegetable Consolidators

Do not accidentally use real customer financial information or sensitive real-world identifiers.

---

# Demo People

Use realistic fictional Filipino names.

Examples:

- Joel Mendoza
- Ramon Villanueva
- Dennis Cruz
- Mark Anthony Reyes
- Carlo Santos
- Marites Garcia
- Jennifer Bautista
- Roberto Dela Cruz

Use obviously fictional contact numbers.

Never use known real individuals as demo customers unless explicitly requested.

---

# IDs and Naming

Use readable deterministic IDs.

Examples:

```text
FR-260925-001
FR-260925-002

TRIP-260925-01

PO-260925-014

INV-260925-023

PAY-260925-008

BATCH-SF-260925-001
```

Maintain consistent formatting throughout the application.

---

# Vehicle Data

Initial fleet:

## Truck 01

```text
Make/Model: Isuzu Giga
Type: 10-Wheeler Closed Van
Capacity: ~8,500 kg
```

## Truck 02

```text
Make/Model: Hino 500
Type: 10-Wheeler Closed Van
Capacity: ~8,500 kg
```

Use fictional plate numbers.

Do not imply vehicle specifications are exact manufacturer limits.

Capacity in the demo should represent the operator's configured operational payload for simulation.

---

# Core UX Principle

The platform must support the business's existing channels.

Do NOT design as though all customers immediately adopt the customer portal.

Orders may originate from:

```text
Facebook Messenger
Phone
Facebook Lead
Customer Portal
Sales Staff
Repeat Order
```

Every channel eventually feeds:

```text
Central Order Management
```

The product should help the business migrate gradually from manual operations.

---

# Internal Navigation

Recommended primary sidebar:

```text
Command Center
Dashboard

Sales
  Orders
  Customers
  Leads

Operations
  Dispatch
  Deliveries
  Trips
  Backhaul

Inventory
  Products
  Inventory

Procurement
  Procurement
  Purchase Orders
  Suppliers

Finance
  Receivables
  Payments
  Expenses

Fleet
  Trucks
  Drivers

Analytics
  Reports

Administration
  Settings
```

Avoid an excessively long flat sidebar.

Use grouped navigation where appropriate.

---

# Priority Screens

When improving the product, prioritize these screens:

1. Operations Command Center
2. Dashboard
3. Orders
4. Order Detail
5. Create Order
6. Customers
7. Customer Detail
8. Dispatch
9. Trips
10. Trip Detail
11. Procurement
12. Backhaul
13. Accounts Receivable
14. Public Product Catalog
15. Wholesale Ordering Flow

These screens should receive more design attention than secondary settings pages.

---

# Operations Command Center

This is a flagship screen.

It should summarize today's entire operation.

Recommended sections:

```text
Orders Received
Orders Confirmed
Orders Awaiting Stock
Products Reserved
Trucks Assigned
Trucks Loading
Deliveries In Transit
Deliveries Completed
Backhaul Procurement
Expected Collections
```

Important alerts:

- inventory shortage
- late delivery
- capacity issue
- overdue account
- procurement requirement
- truck underutilization
- unused backhaul capacity

The command center should make it possible for an owner to understand the business in less than one minute.

---

# Orders

Order tables should support:

- search
- sorting
- pagination
- filters
- source filter
- delivery-area filter
- payment-status filter
- order-status filter
- date range

Typical columns:

```text
Order No.
Customer
Source
Products
Delivery Area
Delivery Date
Total
Payment
Status
Truck
Actions
```

Do not overload rows with too much text.

Use concise badges and secondary text.

---

# Order Creation

The Create Order experience must support orders received manually by staff.

Required fields:

- Customer
- Order Source
- Product Rows
- Quantity
- Unit
- Unit Price
- Wholesale Discount
- Delivery Address
- Requested Delivery Date
- Payment Terms
- Notes

Support multiple items.

Totals should update immediately.

Actions:

```text
Save Draft
Confirm Order
```

---

# Customer CRM

A customer profile should show:

- company / trading name
- type
- contact people
- delivery addresses
- credit terms
- credit limit
- outstanding balance
- lifetime sales
- average order
- order frequency
- preferred products
- recent orders
- invoices
- payments
- standing orders
- sales notes
- lead source

The customer profile should feel like an operations-focused B2B CRM rather than a generic sales CRM.

---

# Inventory

Inventory concepts:

```text
Available
Reserved
Incoming
Damaged / Spoiled
```

Inventory can be located in:

- Lucena Main Warehouse
- Truck 01
- Truck 02
- Temporary Manila Pickup
- Supplier Pickup

Track batches/lots.

Show origin/source where useful.

---

# Trip Management

Trips are central to the platform.

Each trip should connect:

- truck
- driver
- helper if applicable
- orders
- delivery stops
- outbound cargo
- return cargo
- procurement pickups
- fuel
- toll
- allowances
- loading/unloading expenses
- other expenses
- trip revenue
- trip cost
- contribution / margin

Example route:

```text
Lucena
→ Navotas
→ Valenzuela
→ Lucena
```

Outbound:

```text
Seafood deliveries
```

Return:

```text
Onion / garlic / ginger procurement
```

---

# Backhaul

Backhaul is a major differentiator.

Always consider both:

```text
Outbound Utilization
Return Utilization
```

A trip is not complete conceptually until the return load is accounted for.

Useful calculations:

```text
Outbound Capacity %
Return Capacity %
Unused Return Capacity
Loaded Kilometers
Empty Kilometers
Trip Revenue
Trip Cost
Trip Contribution
```

Example insight:

> Truck 01 has 5,500 kg unused return capacity.

Example recommendation:

> PO-260925-016 can be assigned to Truck 01 without exceeding configured payload capacity.

These may be simulated rules in the frontend.

Do not imply machine-learning intelligence unless actual ML is implemented.

---

# Procurement

Procurement requirements should ideally be derived from:

```text
Confirmed Demand
- Available Inventory
- Incoming Inventory
= Procurement Requirement
```

Supplier comparisons may consider:

- price
- available quantity
- pickup location
- route proximity
- reliability
- previous transaction history

Keep "recommended supplier" logic explainable.

---

# Accounts Receivable

Wholesale customers may use:

- Cash
- COD
- Partial Payment
- Credit Terms
- Bank Transfer
- Check

Track aging:

```text
Current
1–7 Days
8–30 Days
31–60 Days
60+ Days
```

The platform should make overdue exposure highly visible to the owner.

---

# Public Ordering Portal

The external website should feel like a B2B wholesale catalog, not consumer e-commerce.

Primary actions:

```text
Browse Products
Place Wholesale Order
Request Quote
View My Orders
```

Product cards can show:

- product
- availability
- indicative price
- MOQ
- unit
- origin
- next dispatch

For larger volumes:

```text
Request Wholesale Quote
```

This is more appropriate than assuming every transaction has a fixed retail price.

---

# Wholesale Ordering

Order submissions should initially be:

```text
Pending Confirmation
```

Use language similar to:

> Your wholesale order has been received and is subject to stock, pricing, and delivery confirmation.

Do not promise instant fulfillment.

---

# Standing Orders

Recurring order examples:

```text
Monday
Sugpo — 80 kg

Wednesday
Tahong — 100 kg

Friday
Sugpo — 100 kg
Talaba — 50 kg
```

Support:

- Active
- Paused
- Cancelled

---

# Lead Management

Sources:

- Facebook Marketplace
- Facebook Group
- Facebook Page
- Messenger
- Referral
- Walk-in
- Existing Customer Referral

Pipeline:

```text
New
→ Contacted
→ Quoted
→ Sample Order
→ Negotiating
→ Won / Lost
```

Allow:

```text
Convert Lead → Customer
```

---

# Charts

Use Recharts.

Charts should answer an operational question.

Good examples:

- revenue trend
- revenue by route
- top-selling products
- customer concentration
- truck utilization
- outbound vs return utilization
- receivables aging
- procurement spending

Do not add charts purely for decoration.

---

# Tables

Use TanStack Table where interaction complexity warrants it.

Tables should support:

- sortable columns
- useful filters
- search
- pagination
- responsive overflow
- row actions

On small screens, use a card representation when tables become unusable.

---

# UI Design Rules

The design should feel:

- modern
- professional
- operational
- data-rich without being cluttered
- appropriate for Philippine SMEs and mid-sized trading businesses

Avoid:

- overly playful visuals
- excessive gradients
- glassmorphism everywhere
- neon color palettes
- crypto-dashboard aesthetics
- huge marketing-style headings inside operations screens
- excessive animations

Favor:

- clean typography
- good spacing
- clear hierarchy
- subtle borders
- strong tables
- concise status badges
- readable numbers

---

# Responsive Requirements

## Desktop

Primary experience for:

- owner
- accounting
- dispatcher
- procurement
- sales staff

## Tablet

Optimize for:

- warehouse
- dispatch
- manager review

## Mobile

Optimize for:

- owner quick monitoring
- sales staff
- drivers
- customers

---

# Driver View

The driver interface should be intentionally simple.

Show:

- current trip
- assigned truck
- stops
- customer
- contact
- products / quantity
- delivery notes
- status

Actions:

```text
Call Customer
Mark Arrived
Upload POD
Mark Delivered
```

Avoid exposing unnecessary internal financial information to the driver role.

---

# Role-Based Demo Behavior

Demo roles:

- Owner
- Sales
- Dispatcher
- Procurement
- Accounting
- Driver
- Customer

When practical:

- change navigation visibility
- change dashboard emphasis
- prevent irrelevant actions visually

This is demo-level behavior only unless authentication is later implemented.

---

# Components to Reuse

Prefer reusable components such as:

```text
PageHeader
KPICard
MoneyDisplay
StatusBadge
FilterBar
DataTable
EmptyState
Timeline
CapacityBar
ProductCard
CustomerCard
TripCard
ReceivableBadge
MetricTrend
SectionHeader
ConfirmDialog
EntitySearch
```

Do not build one-off versions of the same visual pattern repeatedly.

---

# Form Standards

Use:

- React Hook Form
- Zod

Required:

- field labels
- validation messages
- disabled/loading states
- success state
- clear submit actions
- meaningful defaults

Do not rely on placeholder text as a replacement for field labels.

---

# Accessibility

At minimum:

- semantic HTML
- keyboard-accessible controls
- visible focus states
- form labels
- accessible buttons
- sufficient contrast
- appropriate `aria-*` attributes when necessary

---

# Loading / Empty / Error States

Every major page should account for:

- loading
- success
- empty
- error

Do not leave unfinished blank areas.

Examples:

```text
No orders found for the selected filters.

No overdue receivables.

No trips scheduled today.
```

---

# Demo Data Volume

Aim for approximately:

```text
40 customers
25 suppliers
30 products / SKUs
100+ orders
20 leads
20 purchase orders
30 payments
15 trips
2 trucks
4 drivers
multiple inventory batches
```

You do not need to render every record on screen simultaneously.

Use pagination/filtering.

---

# Calculation Rules

Centralize calculations.

Examples:

```ts
orderSubtotal
orderDiscount
orderTotal
outstandingBalance
invoiceBalance
truckUtilization
returnUtilization
tripRevenue
tripCost
tripContribution
inventoryAvailable
inventoryReserved
inventoryShortage
```

Do not duplicate calculations across multiple pages.

---

# Money and Business Metrics

Be precise with labels.

Prefer:

```text
Revenue
Cost
Gross Margin
Contribution
Outstanding Balance
Average Order Value
Inventory Value
```

Do not call revenue "profit."

Do not call gross contribution "net income."

Use financially accurate terminology.

---

# Status Colors

Use consistent semantic status styling.

Conceptually:

- neutral = draft / inactive
- info = scheduled / pending
- warning = attention required
- success = confirmed / paid / delivered
- destructive = overdue / failed / cancelled

Do not rely on color alone; always include text or icons.

---

# Images

Product images should be:

- believable
- consistent aspect ratio
- relevant to seafood or produce

Avoid obviously generic unrelated stock imagery.

If images are unavailable, use tasteful placeholders rather than broken images.

---

# Future Modules

Do not implement these unless explicitly requested:

- marketplace
- supplier bidding
- backhaul freight marketplace
- live GPS
- temperature monitoring
- route optimization
- AI demand forecasting
- price intelligence
- inter-island logistics automation
- external API integrations

They may appear as:

```text
Coming Soon
```

Keep future concepts visually separate from Phase 1 functionality.

---

# Avoid Scope Creep

Before adding a feature, ask:

1. Does it improve current trading operations?
2. Does it help order management?
3. Does it help logistics?
4. Does it help procurement?
5. Does it help collections?
6. Does it help management visibility?

If none apply, it probably does not belong in Phase 1.

---

# Code Quality Expectations

When changing the application:

1. Inspect existing patterns before introducing new ones.
2. Reuse existing UI components.
3. Avoid duplicating domain types.
4. Avoid `any`.
5. Keep TypeScript strict.
6. Keep imports clean.
7. Delete unused code.
8. Do not leave commented-out experiments.
9. Keep client components limited to areas that require client behavior.
10. Prefer server components where appropriate.
11. Avoid unnecessary dependencies.
12. Maintain responsive behavior.
13. Verify related pages after changing shared mock data.

---

# Before Completing a Task

For each implementation task:

1. Understand the affected workflow.
2. Identify related entities.
3. Reuse existing data relationships.
4. Implement the UI.
5. Verify loading/empty/error states.
6. Verify responsive layout.
7. Verify TypeScript.
8. Verify related entity references.
9. Check for unrealistic Philippine demo data.
10. Ensure the workflow still reflects real wholesale/logistics operations.

---

# Important Product Decisions

## Do not force portal adoption

The customer portal is an additional channel.

Manual orders remain first-class.

## Do not treat this as retail e-commerce

This is B2B wholesale.

Orders can involve:

- negotiated prices
- MOQs
- standing orders
- credit terms
- manual confirmation
- bulk quantities

## Treat logistics and procurement as one continuous workflow

Outbound delivery and return procurement are intentionally connected.

## Protect the backhaul concept

Backhaul optimization is a key business differentiator.

## Keep owner visibility excellent

The owner should quickly understand:

- what sold
- what is pending
- what is being delivered
- where the trucks are
- what is being procured
- how much capacity is unused
- who owes money
- expected revenue/cost/margin

---

# Definition of Done

A feature is not complete because the page merely renders.

It should:

- fit the domain
- use realistic PH data
- connect to related records
- support common states
- work responsively
- match existing design patterns
- use accurate business terminology
- provide useful operational information
- avoid introducing unnecessary complexity

---

# Product North Star

TradeRoute should make this transformation obvious:

```text
Facebook + Messenger + Phone Calls + Paper + Memory
```

into:

```text
Lead
→ Customer
→ Order
→ Inventory
→ Dispatch
→ Delivery
→ Procurement
→ Backhaul
→ Collection
→ Analytics
```

The end product should feel like a credible operating system for a Philippine wholesale trading, distribution, and logistics business—not a generic admin template.

