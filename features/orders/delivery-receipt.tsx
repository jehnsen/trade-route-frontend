"use client";

import { Printer } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap } from "@/hooks/use-data";
import { COMPANY } from "@/data/company";
import { productById, productLabel } from "@/data/products";
import { truckById, driverById } from "@/data/fleet";
import { itemAmount, orderSubtotal, orderTotal } from "@/lib/calc";
import { fmtDate, fmtTime, peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/brand";
import { RecordNotFound } from "@/components/shared/states";

export function DeliveryReceipt({ id }: { id: string }) {
  const order = useAppStore((s) => s.orders.find((o) => o.id === id));
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
  const customers = useCustomerMap();
  if (!order) return <div className="p-6"><RecordNotFound kind="Order" id={id} backHref="/orders" backLabel="Back to orders" /></div>;
  const c = customers.get(order.customerId)!;
  const address = c.addresses.find((a) => a.id === order.addressId) ?? c.addresses[0];
  const trip = trips.find((t) => t.id === order.tripId);
  const delivery = deliveries.find((d) => d.orderId === order.id);
  const drNo = order.id.replace("FR-", "DR-");
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
            <div className="text-lg font-bold tracking-wide">DELIVERY RECEIPT</div>
            <div className="mt-1 font-mono text-base">{drNo}</div>
            <div className="text-slate-600">Order {order.id}</div>
            <div className="text-slate-600">Date {fmtDate(order.deliveryDate)}</div>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-6 border-b py-4">
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Deliver to</div>
            <div className="font-semibold">{c.name}</div>
            <div>{address.line1}</div>
            <div>
              {address.barangay}, {address.city}, {address.province}
            </div>
            <div className="text-slate-600">
              Attn: {c.contacts[0].name} · {c.contacts[0].phone}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Info label="Terms" value={order.paymentTerms} />
            <Info label="Truck" value={trip ? `${truckById(trip.truckId).code} (${truckById(trip.truckId).plateNo})` : order.fulfillment === "pickup" ? "Bodega pickup" : "Partner"} />
            <Info label="Driver" value={trip ? driverById(trip.driverId).name : "—"} />
            <Info label="Trip" value={trip?.id ?? "—"} />
            <Info label="ETA" value={delivery ? fmtTime(delivery.eta) : "—"} />
            <Info label="Receiving" value={order.deliveryWindow ?? "—"} />
          </div>
        </section>
        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b text-left text-[11px] tracking-wide text-slate-500 uppercase">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2">Unit</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 text-right">Qty received</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => {
              const p = productById(i.productId);
              return (
                <tr key={i.productId} className="border-b">
                  <td className="py-2">
                    {productLabel(p)} <span className="text-slate-500">({p.sku})</span>
                  </td>
                  <td className="py-2 text-right tabular">{i.quantity.toLocaleString()}</td>
                  <td className="py-2">{p.unit === "pc" ? "pcs" : "kg"}</td>
                  <td className="py-2 text-right tabular">{peso(i.unitPrice, true)}</td>
                  <td className="py-2 text-right tabular">{peso(itemAmount(i), true)}</td>
                  <td className="py-2 text-right">______</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 ml-auto grid w-72 gap-1">
          <Line label="Subtotal" value={peso(orderSubtotal(order), true)} />
          {order.discount > 0 && <Line label="Wholesale discount" value={`−${peso(order.discount, true)}`} />}
          {order.deliveryFee > 0 && <Line label="Delivery fee" value={peso(order.deliveryFee, true)} />}
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <span>Total</span>
            <span className="tabular">{peso(orderTotal(order), true)}</span>
          </div>
          {order.paymentTerms === "COD" && <div className="text-right text-xs text-slate-600">COD — collect upon delivery</div>}
        </div>
        {order.notes && <p className="mt-4 rounded bg-slate-50 p-3 text-slate-700">Notes: {order.notes}</p>}
        <section className="mt-10 grid grid-cols-3 gap-6 text-center text-xs">
          {["Prepared by (Bodega)", "Delivered by (Driver)", "Received in good order by"].map((l) => (
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
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
