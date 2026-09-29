import type { Driver, MaintenanceRecord, Truck, VehicleDocument } from "@/types";

export const TRUCKS: Truck[] = [
  {
    id: "TRK-01",
    code: "Truck 01",
    name: "Isuzu Giga 10-Wheeler Closed Van",
    make: "Isuzu",
    model: "Giga FVM 34",
    vehicleType: "10-Wheeler Closed Van",
    body: "Insulated closed van, 32 ft",
    plateNo: "NCR 4821",
    year: 2019,
    capacityKg: 8500,
    cargoVolumeCbm: 52,
    mileageKm: 284500,
    fuelEfficiencyKmPerL: 3.4,
    primaryDriverId: "DRV-01",
    color: "var(--chart-1)",
  },
  {
    id: "TRK-02",
    code: "Truck 02",
    name: "Hino 500 10-Wheeler Closed Van",
    make: "Hino",
    model: "500 Series FL8J",
    vehicleType: "10-Wheeler Closed Van",
    body: "Insulated closed van, 30 ft",
    plateNo: "NCR 6398",
    year: 2021,
    capacityKg: 8500,
    cargoVolumeCbm: 48,
    mileageKm: 199150,
    fuelEfficiencyKmPerL: 3.7,
    primaryDriverId: "DRV-02",
    color: "var(--chart-2)",
  },
];

export const DRIVERS: Driver[] = [
  { id: "DRV-01", name: "Joel Mendoza", initials: "JM", phone: "0917 245 8813", licenseNo: "D07-19-••••12", licenseExpiry: "2029-04-17", licenseRestrictions: "Code C, CE (heavy trucks)", assignedTruckId: "TRK-01", hiredDate: "2019-06-03", address: "Brgy. Ibabang Iyam, Lucena City", emergencyContact: "Marilou Mendoza (wife) — 0928 330 1146", unavailable: [] },
  { id: "DRV-02", name: "Ramon Villanueva", initials: "RV", phone: "0918 663 2045", licenseNo: "D07-16-••••73", licenseExpiry: "2026-11-02", licenseRestrictions: "Code C, CE (heavy trucks)", assignedTruckId: "TRK-02", hiredDate: "2021-02-15", address: "Brgy. Market View, Lucena City", emergencyContact: "Elena Villanueva (wife) — 0917 552 0381", unavailable: [{ from: "2026-09-28", to: "2026-09-29", reason: "Leave — daughter's graduation in Lucban" }] },
  { id: "DRV-03", name: "Dennis Cruz", initials: "DC", phone: "0927 801 4439", licenseNo: "D07-20-••••34", licenseExpiry: "2030-01-25", licenseRestrictions: "Code C, CE (heavy trucks)", assignedTruckId: "TRK-01", hiredDate: "2022-08-01", address: "Brgy. Isabang, Tayabas City", emergencyContact: "Luz Cruz (mother) — 0936 204 7719", unavailable: [{ from: "2026-09-25", to: "2026-09-25", reason: "Rest day" }] },
  { id: "DRV-04", name: "Mark Anthony Reyes", initials: "MR", phone: "0995 330 7621", licenseNo: "D07-21-••••06", licenseExpiry: "2031-07-09", licenseRestrictions: "Code C, CE (heavy trucks)", assignedTruckId: "TRK-02", hiredDate: "2023-03-20", address: "Brgy. Gulang-Gulang, Lucena City", emergencyContact: "Jennifer Reyes (wife) — 0917 108 5524", unavailable: [] },
];

/** Workshop records. Trip-side roadside repairs are logged as trip expenses instead. */
export const MAINTENANCE: MaintenanceRecord[] = [
  // Truck 01 — Isuzu Giga
  { id: "MNT-001", truckId: "TRK-01", type: "Tire Replacement", date: "2026-07-02", odometerKm: 271420, vendor: "Lucena Tire Supply", cost: 76000, notes: "Replaced 4 rear drive tires (11R22.5).", nextServiceKm: 331420, status: "Completed", downtimeHours: 4 },
  { id: "MNT-002", truckId: "TRK-01", type: "Preventive Maintenance", date: "2026-09-01", odometerKm: 279960, vendor: "Isuzu Service Center, Lucena", cost: 24650, notes: "PMS — engine oil, fuel & air filters, greasing. Interval 10,000 km.", nextServiceDate: "2026-10-30", nextServiceKm: 290000, status: "Completed", downtimeHours: 8 },
  { id: "MNT-003", truckId: "TRK-01", type: "Brake Service", date: "2026-09-14", odometerKm: 282130, vendor: "Quezon Heavy Truck Services, Lucena", cost: 38400, notes: "Rear brake chamber and brake lining replacement (axle 2). Truck off the road for the day.", status: "Completed", downtimeHours: 22 },
  { id: "MNT-004", truckId: "TRK-01", type: "Other", date: "2026-09-21", odometerKm: 284000, vendor: "Lucena Tire Supply", cost: 2800, notes: "Tire rotation and alignment check — deferred twice because of Navotas bookings.", status: "Scheduled" },
  { id: "MNT-005", truckId: "TRK-01", type: "Aircon", date: "2026-10-03", odometerKm: 285900, vendor: "Coolmaster Auto Aircon, Lucena", cost: 6500, notes: "Cab aircon cleaning and freon top-up (drivers reported weak cooling).", status: "Scheduled" },
  { id: "MNT-006", truckId: "TRK-01", type: "Body Repair", date: "2026-05-18", odometerKm: 262300, vendor: "Batangas Van Body Works", cost: 18900, notes: "Insulation panel repair and rear door seal replacement.", status: "Completed", downtimeHours: 30 },
  // Truck 02 — Hino 500
  { id: "MNT-007", truckId: "TRK-02", type: "Electrical", date: "2026-06-22", odometerKm: 180950, vendor: "Lucena Auto Electrical", cost: 14200, notes: "Alternator rebuild and battery replacement.", status: "Completed", downtimeHours: 12 },
  { id: "MNT-008", truckId: "TRK-02", type: "Oil Change", date: "2026-08-03", odometerKm: 188420, vendor: "Hino Service Center, Calamba", cost: 9800, notes: "Engine oil and oil filter change; brake and suspension inspection after a Pasay pothole impact.", status: "Completed", downtimeHours: 3 },
  { id: "MNT-009", truckId: "TRK-02", type: "Preventive Maintenance", date: "2026-09-08", odometerKm: 194880, vendor: "Hino Service Center, Calamba", cost: 22300, notes: "PMS — oil change, filters, clutch adjustment. Interval 5,000 km (heavy stop-and-go use).", nextServiceDate: "2026-10-20", nextServiceKm: 200000, status: "Completed", downtimeHours: 10 },
  { id: "MNT-010", truckId: "TRK-02", type: "Brake Service", date: "2026-09-28", odometerKm: 199600, vendor: "Quezon Heavy Truck Services, Lucena", cost: 18500, notes: "Front brake pads and drum resurfacing. Truck unavailable Monday.", status: "Scheduled" },
  { id: "MNT-011", truckId: "TRK-02", type: "Engine Repair", date: "2026-04-14", odometerKm: 169300, vendor: "Hino Service Center, Calamba", cost: 41500, notes: "Injector cleaning and turbo hose replacement.", status: "Completed", downtimeHours: 26 },
];

export const VEHICLE_DOCUMENTS: VehicleDocument[] = [
  { id: "DOC-001", type: "OR/CR", truckId: "TRK-01", reference: "CR No. ••••-4471", issuer: "LTO Lucena District Office", issueDate: "2026-03-28", expiryDate: "2027-03-31", attachment: "TRK01-ORCR-2026.pdf" },
  { id: "DOC-002", type: "Comprehensive Insurance", truckId: "TRK-01", reference: "Policy CV-••••-8812", issuer: "Southern Tagalog Mutual Insurance (demo)", issueDate: "2026-02-14", expiryDate: "2027-02-14", attachment: "TRK01-insurance.pdf" },
  { id: "DOC-003", type: "CTPL Insurance", truckId: "TRK-01", reference: "COC ••••5520", issuer: "Southern Tagalog Mutual Insurance (demo)", issueDate: "2026-03-20", expiryDate: "2027-03-20" },
  { id: "DOC-004", type: "Emission Test", truckId: "TRK-01", reference: "PETC ••••-0931", issuer: "Lucena Emission Testing Center", issueDate: "2026-03-26", expiryDate: "2027-03-26" },
  { id: "DOC-005", type: "LTFRB Franchise (CPC)", truckId: "TRK-01", reference: "Case No. 2022-••••-TH", issuer: "LTFRB Region IV-A", issueDate: "2022-01-17", expiryDate: "2027-01-17", attachment: "TRK01-CPC.pdf", notes: "Trucks-for-hire franchise covering Region IV-A to NCR." },
  { id: "DOC-006", type: "Fish Port Gate Pass", truckId: "TRK-01", reference: "NFPC-TP-••••18", issuer: "Navotas Fish Port Complex (demo)", issueDate: "2026-07-01", expiryDate: "2026-12-31" },
  { id: "DOC-007", type: "OR/CR", truckId: "TRK-02", reference: "CR No. ••••-9026", issuer: "LTO Lucena District Office", issueDate: "2026-06-26", expiryDate: "2027-06-30", attachment: "TRK02-ORCR-2026.pdf" },
  { id: "DOC-008", type: "Comprehensive Insurance", truckId: "TRK-02", reference: "Policy CV-••••-3347", issuer: "Southern Tagalog Mutual Insurance (demo)", issueDate: "2025-10-12", expiryDate: "2026-10-12", attachment: "TRK02-insurance.pdf", notes: "Renewal quote requested from broker." },
  { id: "DOC-009", type: "CTPL Insurance", truckId: "TRK-02", reference: "COC ••••7713", issuer: "Southern Tagalog Mutual Insurance (demo)", issueDate: "2026-06-20", expiryDate: "2027-06-20" },
  { id: "DOC-010", type: "Emission Test", truckId: "TRK-02", reference: "PETC ••••-4418", issuer: "Lucena Emission Testing Center", issueDate: "2026-06-24", expiryDate: "2027-06-24" },
  { id: "DOC-011", type: "LTFRB Franchise (CPC)", truckId: "TRK-02", reference: "Case No. 2021-••••-TH", issuer: "LTFRB Region IV-A", issueDate: "2021-11-08", expiryDate: "2026-11-08", notes: "Extension application to be filed before Oct 25." },
  { id: "DOC-012", type: "Fish Port Gate Pass", truckId: "TRK-02", reference: "NFPC-TP-••••24", issuer: "Navotas Fish Port Complex (demo)", issueDate: "2026-07-01", expiryDate: "2026-09-20", notes: "Q3 pass lapsed — Truck 02 cannot enter the port complex until renewed." },
  { id: "DOC-013", type: "Driver's License", driverId: "DRV-01", reference: "D07-19-••••12", issuer: "LTO", issueDate: "2024-04-17", expiryDate: "2029-04-17" },
  { id: "DOC-014", type: "Driver's License", driverId: "DRV-02", reference: "D07-16-••••73", issuer: "LTO", issueDate: "2021-11-02", expiryDate: "2026-11-02", notes: "Renewal appointment booked Oct 14." },
  { id: "DOC-015", type: "Driver's License", driverId: "DRV-03", reference: "D07-20-••••34", issuer: "LTO", issueDate: "2025-01-25", expiryDate: "2030-01-25" },
  { id: "DOC-016", type: "Driver's License", driverId: "DRV-04", reference: "D07-21-••••06", issuer: "LTO", issueDate: "2021-07-09", expiryDate: "2031-07-09" },
  { id: "DOC-017", type: "NBI Clearance", driverId: "DRV-03", reference: "NBI ••••-2291", issuer: "NBI Lucena Satellite Office", issueDate: "2025-09-18", expiryDate: "2026-09-18", notes: "Expired — required by Hotel Luntian receiving." },
  { id: "DOC-018", type: "Drug Test", driverId: "DRV-04", reference: "DT-••••61", issuer: "DOH-accredited clinic, Lucena", issueDate: "2026-04-02", expiryDate: "2027-04-02" },
  { id: "DOC-019", type: "NBI Clearance", driverId: "DRV-01", reference: "NBI ••••-1175", issuer: "NBI Lucena Satellite Office", issueDate: "2026-01-12", expiryDate: "2027-01-12" },
];

export const truckById = (id: string) => TRUCKS.find((t) => t.id === id)!;
export const driverById = (id: string) => DRIVERS.find((d) => d.id === id)!;

/** Whether the driver is on leave / rest day on a given date. */
export function driverUnavailability(driverId: string, date: string) {
  return driverById(driverId).unavailable.find((u) => u.from <= date && u.to >= date);
}
