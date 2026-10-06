import type { Driver, Truck } from "@/types";

// Tenant registries: the organization's trucks and drivers, filled by `applyTenantProfile`
// (data/tenant.ts) before any screen renders.
export const TRUCKS: Truck[] = [];
export const DRIVERS: Driver[] = [];

export const truckById = (id: string) => TRUCKS.find((t) => t.id === id)!;
export const driverById = (id: string) => DRIVERS.find((d) => d.id === id)!;

/** Whether the driver is on leave / rest day on a given date. */
export function driverUnavailability(driverId: string, date: string) {
  return driverById(driverId).unavailable.find((u) => u.from <= date && u.to >= date);
}
