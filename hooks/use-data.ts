"use client";

import type { Customer } from "@/types";
import { useAppStore } from "@/lib/store";
import { LIFETIME_BASELINE } from "@/data/finance";
import { getCustomerStats, getInvoiceMap, getInvoices, getTripMetricsMap } from "@/lib/logistics";
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

export function useStock() {
  const inventory = useAppStore((s) => s.inventory);
  const orders = useAppStore((s) => s.orders);
  const pos = useAppStore((s) => s.purchaseOrders);
  return getStockMap(inventory, orders, pos);
}

export function useDailyRevenue() {
  return getDailyRevenue(useAppStore((s) => s.orders));
}

export function useProductSales() {
  return getProductSales(useAppStore((s) => s.orders));
}
