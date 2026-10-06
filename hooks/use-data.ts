"use client";

import type { Customer, ProductStock } from "@/types";
import { useAppStore } from "@/lib/store";
import { LIFETIME_BASELINE } from "@/data/finance";
import { getCustomerStats, getInvoiceMap, getInvoices, getTripMetricsMap } from "@/lib/logistics";
import { getBoardMatches, getCapacityViews } from "@/lib/load-board";
import { getListingViews } from "@/lib/backhaul-marketplace";
import { getDailyRevenue, getProductSales, getSalesCustomerStats, getSalesInvoiceMap, getSalesInvoices, getStockMap } from "@/lib/selectors";
import { memoizeLast } from "@/lib/utils";

// ─── Logistics ──────────────────────────────────────────────────────────────
/** Freight invoices derived from delivered jobs and recorded payments. */
export function useInvoices() {
  const jobs = useAppStore((s) => s.jobs);
  const payments = useAppStore((s) => s.payments);
  return getInvoices(jobs, payments);
}

/** Freight invoice keyed by job id. */
export function useInvoiceMap() {
  return getInvoiceMap(useInvoices());
}

export function useCustomerStats() {
  const customers = useAppStore((s) => s.customers);
  const jobs = useAppStore((s) => s.jobs);
  const invoices = useInvoices();
  return getCustomerStats(customers, jobs, invoices, LIFETIME_BASELINE);
}

export function useTripMetrics() {
  const trips = useAppStore((s) => s.trips);
  const jobs = useAppStore((s) => s.jobs);
  const loads = useAppStore((s) => s.loads);
  const deliveries = useAppStore((s) => s.deliveries);
  const expenses = useAppStore((s) => s.expenses);
  return getTripMetricsMap(trips, jobs, loads, deliveries, expenses);
}

/** Load-board capacity posts resolved against trips (our trucks) or the partner's posted figures. */
export function useCapacityViews() {
  const posts = useAppStore((s) => s.boardCapacity);
  const trips = useAppStore((s) => s.trips);
  const partners = useAppStore((s) => s.truckingPartners);
  return getCapacityViews(posts, trips, useTripMetrics(), partners);
}

export function useBoardMatches() {
  const loads = useAppStore((s) => s.boardLoads);
  const jobs = useAppStore((s) => s.jobs);
  return getBoardMatches(loads, useCapacityViews(), jobs);
}

/** Backhaul marketplace: today's/tomorrow's return legs and every listed leg, keyed by trip id. */
export function useListingViews() {
  const trips = useAppStore((s) => s.trips);
  const listings = useAppStore((s) => s.backhaulListings);
  const requests = useAppStore((s) => s.backhaulRequests);
  const jobs = useAppStore((s) => s.jobs);
  return getListingViews(trips, listings, requests, useTripMetrics(), jobs);
}

const toMap = <T extends { id: string }>() => memoizeLast((rows: T[]) => new Map(rows.map((r) => [r.id, r])));
const customerMap = toMap<Customer>();
export function useCustomerMap() {
  return customerMap(useAppStore((s) => s.customers));
}

// ─── Trading (Phase 2 preview) ──────────────────────────────────────────────
export function useSalesInvoices() {
  const orders = useAppStore((s) => s.orders);
  const payments = useAppStore((s) => s.salesPayments);
  return getSalesInvoices(orders, payments);
}

export function useSalesInvoiceMap() {
  return getSalesInvoiceMap(useSalesInvoices());
}

export function useSalesCustomerStats() {
  const customers = useAppStore((s) => s.customers);
  const orders = useAppStore((s) => s.orders);
  return getSalesCustomerStats(customers, orders, useSalesInvoices());
}

const stockMapOf = memoizeLast((stock: ProductStock[]) => new Map(stock.map((x) => [x.productId, x])));

/** Stock per product. Visitors and customers (no stock records loaded) see the storefront's availability. */
export function useStock() {
  const inventory = useAppStore((s) => s.inventory);
  const orders = useAppStore((s) => s.orders);
  const pos = useAppStore((s) => s.purchaseOrders);
  const storefront = useAppStore((s) => s.storefrontStock);
  if (!inventory.length && storefront) return stockMapOf(storefront);
  return getStockMap(inventory, orders, pos);
}

export function useDailyRevenue() {
  return getDailyRevenue(useAppStore((s) => s.orders));
}

export function useProductSales() {
  return getProductSales(useAppStore((s) => s.orders));
}
