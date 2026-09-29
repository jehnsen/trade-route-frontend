import { useAppStore } from "../lib/store";
import { getTripMetricsMap } from "../lib/logistics";
const s = useAppStore.getState();
const m = getTripMetricsMap(s.trips, s.jobs, s.loads, s.deliveries, s.expenses);
for (const id of ["TRIP-260925-01","TRIP-260925-02","TRIP-260926-01","TRIP-260926-02"]) {
  const t = s.trips.find((x) => x.id === id)!; const x = m.get(id)!;
  console.log(id, t.truckId, t.routeId, t.status, t.departure, "out", x.outboundKg, "ret", x.returnKg, "exp ret", t.expectedReturn);
  for (const st of t.stops) console.log("   ", st.seq, st.type, st.location.name, st.location.areaId, st.plannedArrival, st.status);
}
for (const id of ["JOB-260925-009","JOB-260925-010","JOB-260925-021"]) { const j = s.jobs.find((x) => x.id === id)!; console.log(id, j.customerId, j.source, j.leg, j.pickup.name, j.pickup.areaId, "->", j.dropoff.name, j.cargoDescription, j.weightKg, j.freightCharge, j.createdAt, j.status, j.tripId, j.pickupAt); }
console.log(s.customers.find((c) => c.id === "CUS-048")?.name, s.customers.find((c) => c.id === s.jobs.find((x) => x.id === "JOB-260925-010")!.customerId)?.name);
