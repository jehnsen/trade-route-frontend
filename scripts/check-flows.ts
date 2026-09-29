// Exercises logistics store actions and verifies that related records stay consistent.
import { useAppStore } from "../lib/store";
import { LIFETIME_BASELINE } from "../data/finance";
import { LUCENA_WAREHOUSE } from "../data/areas";
import { getCustomerStats, getInvoices, getTripMetricsMap, invoiceIdForJob, tripWarnings, unassignedJobs } from "../lib/logistics";

const s = () => useAppStore.getState();
const metrics = () => getTripMetricsMap(s().trips, s().jobs, s().loads, s().deliveries, s().expenses);
const assert = (cond: unknown, msg: string) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else console.log("ok:", msg);
};

// 1. Book a job for tomorrow and put it on Truck 02's trip
const seaside = s().customers.find((c) => c.id === "CUS-022")!;
const jobId = s().createJob({
  customerId: seaside.id,
  source: "Messenger",
  leg: "outbound",
  pickup: LUCENA_WAREHOUSE,
  dropoff: { name: seaside.name, areaId: "bacoor", address: seaside.addresses[0].line1 },
  consignee: { name: "Marco Villareal", phone: "0917 921 4406" },
  cargo: [{ cargoDescription: "Sugpo (tiger prawn), iced", cargoCategory: "Seafood", quantity: 8, unit: "styro box", weightKg: 200 }],
  truckRequirement: "Insulated van, iced cargo",
  pickupAt: "2026-09-26T02:30",
  requiredBy: "2026-09-26T13:00",
  freightCharge: 2000,
  additionalCharges: [],
  paymentTerms: "COD",
  status: "Awaiting Dispatch",
});
assert(jobId === "JOB-260926-021", `job numbered in tomorrow's series (${jobId})`);
assert(unassignedJobs(s().jobs, "2026-09-26").some((j) => j.id === jobId), "new job is unassigned on the dispatch board");
const before = metrics().get("TRIP-260926-02")!.outboundKg;
s().assignJobToTrip(jobId, "TRIP-260926-02");
const m2 = metrics().get("TRIP-260926-02")!;
assert(m2.outboundKg === before + 200 && m2.jobs.some((j) => j.id === jobId), "trip load increased and lists the job");
assert(s().deliveries.some((d) => d.jobId === jobId && d.tripId === "TRIP-260926-02"), "delivery record created on the trip");
assert(s().trips.find((t) => t.id === "TRIP-260926-02")!.stops.some((st) => st.customerId === "CUS-022"), "trip stops include Seaside Grill");
assert(s().jobs.find((j) => j.id === jobId)!.status === "Assigned", "job status is Assigned");

// 2. Unassign → delivery and stop removed
s().assignJobToTrip(jobId, null);
assert(!s().deliveries.some((d) => d.jobId === jobId), "unassigning removes the delivery");
assert(!s().trips.find((t) => t.id === "TRIP-260926-02")!.stops.some((st) => st.customerId === "CUS-022"), "unassigning removes the stop");

// 3. Deliver a live Truck 01 drop with COD cash → freight invoice paid
const dl = s().deliveries.find((d) => d.jobId === "JOB-260925-003")!;
s().markArrived(dl.id);
s().markDelivered(dl.id, { receivedBy: "Lorna Pascual", signatureCaptured: true, photoCount: 2 }, 4950);
const inv = getInvoices(s().jobs, s().payments).find((i) => i.id === invoiceIdForJob("JOB-260925-003"))!;
assert(inv && inv.balance === 0 && inv.paid === 4950, "COD delivery creates INV-260925-003 fully paid");
assert(s().jobs.find((j) => j.id === "JOB-260925-003")!.status === "Delivered", "job marked Delivered");
assert(s().deliveries.find((d) => d.id === dl.id)!.pod?.receiptNo.startsWith("DR-"), "POD has a DR number");

// 4. Partial payment reduces customer outstanding
const stats = () => getCustomerStats(s().customers, s().jobs, getInvoices(s().jobs, s().payments), LIFETIME_BASELINE).get("CUS-002")!.outstanding;
const beforeOut = stats();
const rjm = getInvoices(s().jobs, s().payments).find((i) => i.customerId === "CUS-002" && i.balance > 0)!;
s().recordPayment({ invoiceId: rjm.id, jobId: rjm.jobId, customerId: "CUS-002", amount: 3000, method: "GCash", reference: "GCash Ref •••• 1234" });
assert(beforeOut - stats() === 3000, `RJM outstanding reduced by ₱3,000 (${beforeOut} → ${stats()})`);

// 5. Backhaul opportunity: add JOB-260925-021 to Truck 01's return leg while in transit
s().assignJobToTrip("JOB-260925-021", "TRIP-260925-01");
const t1 = metrics().get("TRIP-260925-01")!;
assert(t1.returnKg === 5300 && t1.returnKg <= t1.capacityKg, `Truck 01 return load now ${t1.returnKg} kg`);

// 6. Outbound cargo cannot be added to a departed trip
s().assignJobToTrip("JOB-260925-019", "TRIP-260925-01");
assert(!s().jobs.find((j) => j.id === "JOB-260925-019")!.tripId, "outbound job not added to an in-transit trip");

// 7. Accepted quote → job
const fromQuote = s().convertQuoteToJob("QT-260922-001");
assert(s().quotes.find((q) => q.id === "QT-260922-001")!.jobId === fromQuote && s().jobs.some((j) => j.id === fromQuote && j.quoteId === "QT-260922-001"), `accepted quote converted to ${fromQuote}`);

// 8. Plan Monday trip on Truck 02 with Ramon → maintenance + driver warnings
const mon = s().createTrip({ date: "2026-09-28", truckId: "TRK-02", driverId: "DRV-02", helperIds: ["HL-03"], routeId: "RT-CAV", departure: "2026-09-28T05:00" });
const trip = s().trips.find((t) => t.id === mon)!;
const warn = tripWarnings(trip, metrics().get(mon), s().trips, s().maintenance, s().documents).map((w) => w.kind);
assert(mon === "TRIP-260928-01" && warn.includes("maintenance") && warn.includes("driver"), `Monday trip ${mon} flags ${warn.join(", ")}`);

// 9. Cancel a job on a planned trip
s().cancelJob("JOB-260926-003", "Customer postponed");
assert(!s().loads.some((l) => l.jobId === "JOB-260926-003" && l.tripId) && !s().deliveries.some((d) => d.jobId === "JOB-260926-003"), "cancelled job released from its trip");

// 10. Fuel log creates a diesel expense on the trip
const before10 = metrics().get("TRIP-260925-01")!.expenseTotal;
s().addFuelLog({ truckId: "TRK-01", tripId: "TRIP-260925-01", driverId: "DRV-01", date: "2026-09-25T12:00", odometerKm: 284700, liters: 50, pricePerLiter: 63.2, station: "Shell — NLEX Valenzuela", areaId: "valenzuela", fullTank: false });
assert(metrics().get("TRIP-260925-01")!.expenseTotal === before10 + 3160, "fuel top-up adds ₱3,160 diesel to the trip");
