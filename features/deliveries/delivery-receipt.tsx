"use client";

import { Printer } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { COMPANY } from "@/data/company";
import { truckById, driverById } from "@/data/fleet";
import { jobTotal } from "@/lib/logistics";
import { fmtDate, fmtTime, kg, peso } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/brand";
import { RecordNotFound } from "@/components/shared/states";

/** Printable delivery receipt / waybill for one delivery (DLV-…). */
export function DeliveryReceipt({ id }: { id: string }) {
  const d = useAppStore((s) => s.deliveries.find((x) => x.id === id));
  const job = useAppStore((s) => s.jobs.find((j) => j.id === d?.jobId));
  const trip = useAppStore((s) => s.trips.find((t) => t.id === d?.tripId));
  const customer = useAppStore((s) => s.customers.find((c) => c.id === d?.customerId));
  const allLoads = useAppStore((s) => s.loads);
  if (!d || !job || !trip || !customer)
    return (
      <div className="p-6">
        <RecordNotFound kind="Delivery" id={id} backHref="/deliveries" backLabel="Back to deliveries" />
      </div>
    );
  const loads = allLoads.filter((l) => d.loadIds.includes(l.id));
  const truck = truckById(trip.truckId);
  const drNo = d.pod?.receiptNo ?? d.id.replace("DLV-", "DR-");
  return (
    <div className="min-h-dvh bg-muted/40 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2 px-4">
        <Button onClick={() => window.print()}>
          <Printer /> Print delivery receipt
        </Button>
      </div>
      <article className="mx-auto max-w-3xl bg-white p-8 text-[13px] text-slate-900 shadow-sm print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b pb-4">
          <div>
            <Logo tone="light" />
            <div className="mt-2 font-semibold">{COMPANY.name}</div>
            <div className="text-slate-600">{COMPANY.address}</div>
            <div className="text-slate-600">
              {COMPANY.phone} · {COMPANY.mobile} · TIN {COMPANY.tin}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold tracking-wide">DELIVERY RECEIPT / WAYBILL</div>
            <div className="mt-1 font-mono text-base">{drNo}</div>
            <div className="text-slate-600">Job {job.id}</div>
            <div className="text-slate-600">Trip {trip.id}</div>
            <div className="text-slate-600">Date {fmtDate(trip.date)}</div>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-6 border-b py-4">
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Shipper / booked by</div>
            <div className="font-semibold">{customer.name}</div>
            <div className="text-slate-600">Pickup: {job.pickup.name}</div>
            <div className="mt-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Consignee</div>
            <div className="font-semibold">{job.consignee.name}</div>
            <div>{job.dropoff.name}</div>
            <div className="text-slate-600">{job.dropoff.address}</div>
            <div className="text-slate-600">{job.consignee.phone}</div>
          </div>
          <div className="grid grid-cols-2 content-start gap-2">
            <Info label="Truck" value={`${truck.code} (${truck.plateNo})`} />
            <Info label="Driver" value={driverById(trip.driverId).name} />
            <Info label="ETA" value={fmtTime(d.eta)} />
            <Info label="Required by" value={fmtTime(job.requiredBy)} />
            <Info label="Terms" value={job.paymentTerms} />
            <Info label="Freight" value={peso(jobTotal(job))} />
          </div>
        </section>
        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b text-left text-[11px] tracking-wide text-slate-500 uppercase">
              <th className="py-2">Load</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2">Unit</th>
              <th className="py-2 text-right">Gross kg</th>
              <th className="py-2 text-right">Qty received</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-2 font-mono text-xs">{l.id}</td>
                <td className="py-2">{l.cargoDescription}</td>
                <td className="py-2 text-right tabular">{l.quantity}</td>
                <td className="py-2">{l.unit}</td>
                <td className="py-2 text-right tabular">{kg(l.weightKg)}</td>
                <td className="py-2 text-right">______</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-2 font-semibold" colSpan={4}>
                Total
              </td>
              <td className="py-2 text-right font-semibold tabular">{kg(sumBy(loads, (l) => l.weightKg))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        {job.instructions && <p className="mt-4 rounded bg-slate-50 p-3 text-slate-700">Instructions: {job.instructions}</p>}
        {job.paymentTerms === "COD" && <p className="mt-2 text-right text-xs text-slate-600">COD — collect {peso(jobTotal(job))} freight upon delivery</p>}
        <section className="mt-10 grid grid-cols-3 gap-6 text-center text-xs">
          {["Loaded by (Bodega)", "Delivered by (Driver)", "Received in good order by"].map((l) => (
            <div key={l}>
              <div className="h-10 border-b border-slate-400" />
              <div className="mt-1 text-slate-600">{l}</div>
            </div>
          ))}
        </section>
        <p className="mt-6 text-center text-[11px] text-slate-500">This is a delivery receipt, not an official receipt. Demo document generated by TradeLoop.</p>
      </article>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
