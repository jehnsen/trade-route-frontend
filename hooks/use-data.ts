"use client";

import { useAppStore } from "@/lib/store";
import {
  getCustomerStats,
  getDailyRevenue,
  getInvoiceMap,
  getInvoices,
  getProductSales,
  getRoutePerformance,
  getStockMap,
  getTripMetricsMap,
} from "@/lib/selectors";

export function useInvoices() {
  const orders = useAppStore((s) => s.orders);
  const payments = useAppStore((s) => s.payments);
  return getInvoices(orders, payments);
}

export function useInvoiceMap() {
  return getInvoiceMap(useInvoices());
}

export function useCustomerStats() {
  const customers = useAppStore((s) => s.customers);
  const orders = useAppStore((s) => s.orders);
  const invoices = useInvoices();
  return getCustomerStats(customers, orders, invoices);
}

export function useTripMetrics() {
  const trips = useAppStore((s) => s.trips);
  const orders = useAppStore((s) => s.orders);
  const pos = useAppStore((s) => s.purchaseOrders);
  const deliveries = useAppStore((s) => s.deliveries);
  const expenses = useAppStore((s) => s.expenses);
  return getTripMetricsMap(trips, orders, pos, deliveries, expenses);
}

export function useStock() {
  const inventory = useAppStore((s) => s.inventory);
  const orders = useAppStore((s) => s.orders);
  const pos = useAppStore((s) => s.purchaseOrders);
  const trips = useAppStore((s) => s.trips);
  return getStockMap(inventory, orders, pos, trips);
}

export function useDailyRevenue() {
  return getDailyRevenue(useAppStore((s) => s.orders));
}

export function useProductSales() {
  return getProductSales(useAppStore((s) => s.orders));
}

export function useRoutePerformance() {
  const trips = useAppStore((s) => s.trips);
  return getRoutePerformance(trips, useTripMetrics());
}

export function useCustomerMap() {
  const customers = useAppStore((s) => s.customers);
  return customerMapCache(customers);
}
const customerMapCache = (() => {
  let last: unknown;
  let map = new Map<string, import("@/types").Customer>();
  return (customers: import("@/types").Customer[]) => {
    if (customers !== last) {
      last = customers;
      map = new Map(customers.map((c) => [c.id, c]));
    }
    return map;
  };
})();
