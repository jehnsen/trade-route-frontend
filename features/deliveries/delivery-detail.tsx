"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Camera, CheckCircle2, FileText, MapPin, PackageOpen, Phone, Truck } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap } from "@/hooks/use-data";
import { areaName, routeById } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { orderTotal } from "@/lib/calc";
import { orderSummary } from "@/lib/domain";
import { fmtDateTime, fmtDay, fmtTime, peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { AddressDisplay, EmptyState, PageHeader, Stat, Timeline } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { PodCard } from "@/components/shared/pod";
import { RecordNotFound } from "@/components/shared/states";

export function DeliveryDetail({ id }: { id: string }) {
  const d = useAppStore((s) => s.deliveries.find((x) => x.id === id));
  const orders = useAppStore((s) => s.orders);
  const trips = useAppStore((s) => s.trips);
  const markArrived = useAppStore((s) => s.markArrived);
  const markDelivered = useAppStore((s) => s.markDelivered);
  const customers = useCustomerMap();
  if (!d) return <RecordNotFound kind="Delivery" id={id} backHref="/deliveries" backLabel="Back to deliveries" />;
  const o = orders.find((x) => x.id === d.orderId)!;
  const t = trips.find((x) => x.id === d.tripId)!;
  const c = customers.get(o.customerId)!;
  const address = c.addresses.find((a) => a.id === o.addressId) ?? c.addresses[0];
  const confirmed = o.history.find((e) => e.label === "Order confirmed");
  const loading = o.history.find((e) => e.label.startsWith("Loaded") || e.label.startsWith("Loading started"));
  const done = d.status === "Delivered";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Deliveries", href: "/deliveries" }, { label: d.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {d.id} <StatusBadge status={d.status} />
          </span>
        }
        description={`${c.name} · ${areaName(c.areaId)} · stop ${d.stopSeq} on ${t.id}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${c.contacts[0].phone.replace(/\s/g, "")}`}>
                <Phone /> Call customer
              </a>
            </Button>
            {(d.status === "In Transit" || d.status === "Scheduled") && t.status === "In Transit" && (
              <Button size="sm" variant="outline" onClick={() => { markArrived(d.id); toast.success("Marked as arrived"); }}>
                <MapPin /> Mark arrived
              </Button>
            )}
            {["In Transit", "Arrived", "Scheduled"].includes(d.status) && t.status === "In Transit" && (
              <Button size="sm" onClick={() => { markDelivered(d.id, { receivedBy: c.contacts[0].name, photoCount: 2, remarks: "Recorded from office on driver's call." }); toast.success(`${o.id} delivered`, { description: "Invoice issued; POD attached." }); }}>
                <CheckCircle2 /> Mark delivered
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Delivery timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              items={[
                { title: "Order confirmed", at: confirmed ? fmtDateTime(confirmed.at) : undefined, meta: confirmed?.by, state: confirmed ? "done" : "pending", icon: FileText },
                { title: "Loading started", at: loading ? fmtDateTime(loading.at) : undefined, meta: "Lucena Main Warehouse", state: loading ? (t.status === "Loading" ? "current" : "done") : "pending", icon: PackageOpen },
                { title: "Truck departed Lucena", at: t.actualDeparture ? fmtDateTime(t.actualDeparture) : `Planned ${fmtTime(t.departure)}`, meta: `${truckById(t.truckId).code} · ${driverById(t.driverId).name}`, state: t.actualDeparture ? "done" : "pending", icon: Truck },
                { title: `Arrived ${areaName(c.areaId)}`, at: d.arrivedAt ? fmtDateTime(d.arrivedAt) : `ETA ${fmtTime(d.eta)}`, state: d.arrivedAt ? "done" : d.status === "In Transit" ? "current" : "pending", icon: MapPin },
                { title: d.status === "Returned" ? "Delivery failed — returned" : "Delivered", at: d.completedAt ? fmtDateTime(d.completedAt) : undefined, note: d.failureReason, state: d.status === "Returned" ? "failed" : done ? "done" : "pending", icon: CheckCircle2 },
                { title: "Proof of delivery uploaded", at: d.pod ? fmtDateTime(d.pod.signedAt) : undefined, meta: d.pod ? `Received by ${d.pod.receivedBy}` : undefined, state: d.pod ? "done" : "pending", icon: Camera },
              ]}
            />
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Drop details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Stat label="Order" value={<Link href={`/orders/${o.id}`} className="text-primary hover:underline">{o.id}</Link>} sub={`${orderSummary(o, 3)} · ${peso(orderTotal(o))}`} />
              <Stat label="Trip" value={<Link href={`/trips/${t.id}`} className="text-primary hover:underline">{t.id}</Link>} sub={`${routeById(t.routeId).name} · ${fmtDay(t.date)}`} />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="ETA" value={fmtTime(d.eta)} />
                <Stat label="Actual arrival" value={d.arrivedAt ? fmtTime(d.arrivedAt) : "—"} />
                <Stat label="Receiving window" value={o.deliveryWindow ?? "—"} />
                <Stat label="Payment" value={o.paymentTerms} />
              </div>
              <AddressDisplay address={address} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Proof of delivery</CardTitle>
            </CardHeader>
            <CardContent>{d.pod ? <PodCard pod={d.pod} title={c.name} subtitle={o.id} /> : <EmptyState icon={Camera} title="No POD yet" description="The driver uploads the signed DR and photos from the Driver app." />}</CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
