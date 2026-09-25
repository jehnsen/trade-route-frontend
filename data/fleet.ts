import type { Driver, MaintenanceRecord, Truck } from "@/types";

export const TRUCKS: Truck[] = [
  {
    id: "TRK-01",
    code: "Truck 01",
    name: "Isuzu Giga 10-Wheeler Closed Van",
    make: "Isuzu",
    model: "Giga FVM 34",
    body: "Insulated closed van, 32 ft",
    plateNo: "NCR 4821",
    year: 2019,
    capacityKg: 8500,
    cargoVolumeCbm: 52,
    mileageKm: 284500,
    fuelEfficiencyKmPerL: 3.4,
    primaryDriverId: "DRV-01",
    nextMaintenanceKm: 290000,
    nextMaintenanceDate: "2026-10-12",
    registrationExpiry: "2027-03-31",
    insuranceExpiry: "2027-02-14",
    color: "var(--chart-1)",
  },
  {
    id: "TRK-02",
    code: "Truck 02",
    name: "Hino 500 10-Wheeler Closed Van",
    make: "Hino",
    model: "500 Series FL8J",
    body: "Insulated closed van, 30 ft",
    plateNo: "NCR 6398",
    year: 2021,
    capacityKg: 8500,
    cargoVolumeCbm: 48,
    mileageKm: 196300,
    fuelEfficiencyKmPerL: 3.7,
    primaryDriverId: "DRV-02",
    nextMaintenanceKm: 200000,
    nextMaintenanceDate: "2026-10-05",
    registrationExpiry: "2027-06-30",
    insuranceExpiry: "2027-05-09",
    color: "var(--chart-2)",
  },
];

export const DRIVERS: Driver[] = [
  { id: "DRV-01", name: "Joel Mendoza", initials: "JM", phone: "0917 245 8813", licenseNo: "D07-19-004512", licenseExpiry: "2029-04-17", licenseRestrictions: "Code C, CE (heavy trucks)", assignedTruckId: "TRK-01", hiredDate: "2019-06-03", address: "Brgy. Ibabang Iyam, Lucena City", emergencyContact: "Marilou Mendoza (wife) — 0928 330 1146", status: "On Trip" },
  { id: "DRV-02", name: "Ramon Villanueva", initials: "RV", phone: "0918 663 2045", licenseNo: "D07-16-011873", licenseExpiry: "2028-11-02", licenseRestrictions: "Code C, CE (heavy trucks)", assignedTruckId: "TRK-02", hiredDate: "2021-02-15", address: "Brgy. Market View, Lucena City", emergencyContact: "Elena Villanueva (wife) — 0917 552 0381", status: "Available" },
  { id: "DRV-03", name: "Dennis Cruz", initials: "DC", phone: "0927 801 4439", licenseNo: "D07-20-008234", licenseExpiry: "2030-01-25", licenseRestrictions: "Code C, CE (heavy trucks)", assignedTruckId: "TRK-01", hiredDate: "2022-08-01", address: "Brgy. Isabang, Tayabas City", emergencyContact: "Luz Cruz (mother) — 0936 204 7719", status: "Rest Day" },
  { id: "DRV-04", name: "Mark Anthony Reyes", initials: "MR", phone: "0995 330 7621", licenseNo: "D07-21-015906", licenseExpiry: "2031-07-09", licenseRestrictions: "Code C, CE (heavy trucks)", assignedTruckId: "TRK-02", hiredDate: "2023-03-20", address: "Brgy. Gulang-Gulang, Lucena City", emergencyContact: "Jennifer Reyes (wife) — 0917 108 5524", status: "Available" },
];

export const MAINTENANCE: MaintenanceRecord[] = [
  { id: "MNT-001", truckId: "TRK-01", date: "2026-09-14", type: "Repair", description: "Rear brake chamber and brake lining replacement (axle 2)", shop: "Quezon Heavy Truck Services, Lucena", cost: 38400, odometerKm: 282130, downtimeHours: 22 },
  { id: "MNT-002", truckId: "TRK-01", date: "2026-08-10", type: "Preventive Maintenance", description: "PMS 280,000 km — engine oil, fuel & air filters, greasing", shop: "Isuzu Service Center, Lucena", cost: 24650, odometerKm: 279960, downtimeHours: 8 },
  { id: "MNT-003", truckId: "TRK-01", date: "2026-07-02", type: "Tires", description: "Replaced 4 rear drive tires (11R22.5)", shop: "Lucena Tire Supply", cost: 76000, odometerKm: 271420, downtimeHours: 4 },
  { id: "MNT-004", truckId: "TRK-01", date: "2026-05-18", type: "Repair", description: "Reefer insulation panel repair, door seal replacement", shop: "Batangas Van Body Works", cost: 18900, odometerKm: 262300, downtimeHours: 30 },
  { id: "MNT-005", truckId: "TRK-01", date: "2026-03-28", type: "Registration", description: "LTO annual registration & emission test", shop: "LTO Lucena District Office", cost: 12850, odometerKm: 254100, downtimeHours: 5 },
  { id: "MNT-006", truckId: "TRK-02", date: "2026-09-10", type: "Preventive Maintenance", description: "PMS 195,000 km — oil change, filters, clutch adjustment", shop: "Hino Service Center, Calamba", cost: 22300, odometerKm: 194880, downtimeHours: 10 },
  { id: "MNT-007", truckId: "TRK-02", date: "2026-08-03", type: "Inspection", description: "Brake and suspension inspection after Pasay pothole impact", shop: "Quezon Heavy Truck Services, Lucena", cost: 3500, odometerKm: 188420, downtimeHours: 3 },
  { id: "MNT-008", truckId: "TRK-02", date: "2026-06-22", type: "Repair", description: "Alternator rebuild and battery replacement", shop: "Lucena Auto Electrical", cost: 14200, odometerKm: 180950, downtimeHours: 12 },
  { id: "MNT-009", truckId: "TRK-02", date: "2026-06-26", type: "Registration", description: "LTO annual registration & emission test", shop: "LTO Lucena District Office", cost: 12850, odometerKm: 181300, downtimeHours: 5 },
];

export const truckById = (id: string) => TRUCKS.find((t) => t.id === id)!;
export const driverById = (id: string) => DRIVERS.find((d) => d.id === id)!;
