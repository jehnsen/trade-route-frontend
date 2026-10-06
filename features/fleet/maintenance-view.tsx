"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, MoreHorizontal, Plus, Timer, Wrench, XCircle } from "lucide-react";
import type { MaintenanceRecord, MaintenanceType } from "@/types";
import { act } from "@/lib/act";
import { useAppStore } from "@/lib/store";
import { TODAY } from "@/data/company";
import { TRUCKS, truckById } from "@/data/fleet";
import { currentOdometer, maintenanceOutlook } from "@/lib/logistics";
import { fmtDate, fmtDateShort, num, peso, pesoCompact } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/components/ui/primitives";
import { DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, KPICard, LineItem, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

export const MAINTENANCE_TYPES: MaintenanceType[] = ["Preventive Maintenance", "Oil Change", "Tire Replacement", "Brake Service", "Engine Repair", "Electrical", "Aircon", "Body Repair", "Other"];
const WINDOW_START = "2026-08-26";
/** Last day of the two-week planning window (follows the operations clock). */
const soonDate = () => format(addDays(parseISO(TODAY), 14), "yyyy-MM-dd");

const effectiveStatus = (m: MaintenanceRecord) => (m.status === "Scheduled" && m.date < TODAY ? "Overdue" : m.status);

export function MaintenanceView() {
  const records = useAppStore((s) => s.maintenance);
  const trips = useAppStore((s) => s.trips);
  const fuelLogs = useAppStore((s) => s.fuelLogs);
  const setStatus = useAppStore((s) => s.setMaintenanceStatus);
  const [tab, setTab] = React.useState("upcoming");
  const [truck, setTruck] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [scheduling, setScheduling] = React.useState(false);
  const [completing, setCompleting] = React.useState<MaintenanceRecord | null>(null);

  const outlooks = TRUCKS.map((t) => ({ truck: t, odo: currentOdometer(t, trips, fuelLogs), o: maintenanceOutlook(t.id, records, currentOdometer(t, trips, fuelLogs)) }));
  const overdue = records.filter((m) => effectiveStatus(m) === "Overdue");
  const upcoming = records.filter((m) => (m.status === "Scheduled" && m.date >= TODAY) || m.status === "In Progress");
  const history = records.filter((m) => m.status === "Completed" || m.status === "Cancelled");
  const windowDone = history.filter((m) => m.status === "Completed" && m.date >= WINDOW_START);
  const alerts = [
    ...outlooks.flatMap(({ truck: t, o }) => (o.nextPms ? [{ tone: o.nextPms.kmLeft < 1000 ? "warning" : "info", text: o.nextPms.kmLeft >= 0 ? `${t.code} PMS due in ${num(o.nextPms.kmLeft)} km${o.nextPms.dueDate ? ` (or by ${fmtDateShort(o.nextPms.dueDate)})` : ""}.` : `${t.code} PMS overdue by ${num(-o.nextPms.kmLeft)} km.` }] : [])),
    ...overdue.map((m) => ({ tone: "danger", text: `${truckById(m.truckId).code} ${m.type.toLowerCase()} overdue — scheduled ${fmtDateShort(m.date)} at ${m.vendor.split(",")[0]}.` })),
    ...upcoming.filter((m) => m.date <= soonDate()).map((m) => ({ tone: "info", text: `${truckById(m.truckId).code} ${m.type.toLowerCase()} on ${fmtDateShort(m.date)} — truck unavailable for dispatch that day.` })),
  ];

  const list = (tab === "upcoming" ? upcoming : tab === "overdue" ? overdue : tab === "history" ? history : records).filter((m) => truck === "all" || m.truckId === truck);
  const columns: ColumnDef<MaintenanceRecord, unknown>[] = [
    { id: "id", header: "ID", accessorFn: (m) => m.id, cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
    { id: "truck", header: "Truck", accessorFn: (m) => truckById(m.truckId).code, cell: ({ row }) => <Link href={`/trucks/${row.original.truckId}`} className="font-medium whitespace-nowrap hover:underline">{truckById(row.original.truckId).code}</Link> },
    { id: "type", header: "Type", accessorFn: (m) => m.type, cell: ({ row }) => <div className="max-w-[260px]"><div className="font-medium">{row.original.type}</div><div className="truncate text-xs text-muted-foreground">{row.original.notes}</div></div> },
    { id: "date", header: "Date", accessorFn: (m) => m.date, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.date)}</span> },
    { id: "odo", header: "Odometer", accessorFn: (m) => m.odometerKm, meta: { align: "right" }, cell: ({ row }) => num(row.original.odometerKm) },
    { id: "vendor", header: "Vendor / workshop", accessorFn: (m) => m.vendor, cell: ({ row }) => <span className="block max-w-[200px] truncate text-muted-foreground">{row.original.vendor}</span> },
    { id: "cost", header: "Cost", accessorFn: (m) => m.cost, meta: { align: "right" }, cell: ({ row }) => <span className={row.original.status === "Completed" ? "" : "text-muted-foreground"}>{peso(row.original.cost)}{row.original.status === "Completed" ? "" : " est."}</span> },
    { id: "next", header: "Next service", accessorFn: (m) => m.nextServiceKm ?? 0, cell: ({ row }) => (row.original.nextServiceKm || row.original.nextServiceDate ? <span className="text-xs whitespace-nowrap">{row.original.nextServiceKm ? `${num(row.original.nextServiceKm)} km` : ""}{row.original.nextServiceDate ? ` · ${fmtDateShort(row.original.nextServiceDate)}` : ""}</span> : <span className="text-xs text-muted-foreground">—</span>) },
    { id: "status", header: "Status", accessorFn: (m) => effectiveStatus(m), cell: ({ row }) => <StatusBadge status={effectiveStatus(row.original)} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original;
        if (m.status === "Completed" || m.status === "Cancelled") return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.id}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {m.status === "Scheduled" && (
                <DropdownMenuItem onSelect={() => void act(() => setStatus(m.id, "In Progress"), () => toast(`${truckById(m.truckId).code} checked in at ${m.vendor.split(",")[0]}`))}>
                  <Wrench /> Start (truck in shop)
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setCompleting(m)}>
                <CheckCircle2 /> Mark completed
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => void act(() => setStatus(m.id, "Cancelled"), () => toast(`${m.id} cancelled`))}>
                <XCircle /> Cancel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Preventive maintenance, repairs and downtime for both vans. PMS reminders come from the odometer on trips and fuel logs."
        actions={
          <Button onClick={() => setScheduling(true)}>
            <Plus /> Schedule maintenance
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Overdue services" value={overdue.length} icon={AlertTriangle} tone={overdue.length ? "danger" : "success"} hint={overdue.map((m) => `${truckById(m.truckId).code}: ${m.type}`).join(" · ") || "Nothing overdue"} />
        <KPICard label="Upcoming (14 days)" value={upcoming.filter((m) => m.date <= soonDate()).length} icon={CalendarClock} hint="scheduled workshop visits" />
        <KPICard label="Maintenance cost (30 days)" value={pesoCompact(sumBy(windowDone, (m) => m.cost))} icon={Wrench} hint={`${windowDone.length} completed jobs`} />
        <KPICard label="Downtime (30 days)" value={`${sumBy(windowDone, (m) => m.downtimeHours ?? 0)} h`} icon={Timer} hint="truck unavailable for trips" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {outlooks.map(({ truck: t, odo, o }) => (
          <Card key={t.id}>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: t.color }} /> {t.code}
                </CardTitle>
                <CardDescription>
                  {t.plateNo} · odometer {num(odo)} km
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {o.nextPms && (
                <>
                  <LineItem label="Next PMS at" value={`${num(o.nextPms.dueKm)} km`} strong />
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, 100 - (o.nextPms.kmLeft / (t.id === "TRK-01" ? 10000 : 5000)) * 100))}%` }} />
                  </div>
                  <div className={o.nextPms.kmLeft < 1000 ? "text-xs font-medium text-[oklch(0.5_0.13_65)]" : "text-xs text-muted-foreground"}>{o.nextPms.kmLeft >= 0 ? `${num(o.nextPms.kmLeft)} km to go` : "Overdue"}{o.nextPms.dueDate ? ` · or by ${fmtDate(o.nextPms.dueDate)}` : ""}</div>
                </>
              )}
              <LineItem label="Last service" value={o.lastService ? `${o.lastService.type}, ${fmtDateShort(o.lastService.date)}` : "—"} muted />
              <LineItem label="Scheduled" value={o.upcoming.length ? o.upcoming.map((m) => `${m.type} ${fmtDateShort(m.date)}`).join(", ") : "None"} muted />
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-primary" /> Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">No maintenance alerts.</p>}
            {alerts.map((a) => (
              <div key={a.text} className={a.tone === "danger" ? "rounded-md bg-danger-soft px-2.5 py-1.5 text-xs font-medium text-danger" : a.tone === "warning" ? "rounded-md bg-warning-soft px-2.5 py-1.5 text-xs font-medium text-[oklch(0.45_0.11_65)]" : "rounded-md bg-muted px-2.5 py-1.5 text-xs"}>
                {a.text}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-4 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
              <TabsTrigger value="history">History ({history.length})</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <FilterBar search={q} onSearch={setQ} placeholder="Search type, vendor, notes…">
          <FilterSelect value={truck} onChange={setTruck} label="Truck" options={[{ value: "all", label: "Both trucks" }, ...TRUCKS.map((t) => ({ value: t.id, label: t.code }))]} />
        </FilterBar>
        <DataTable columns={columns} data={list} search={q} searchText={(m) => `${m.id} ${m.type} ${m.vendor} ${m.notes} ${truckById(m.truckId).code}`} initialSorting={[{ id: "date", desc: tab === "history" }]} empty={<EmptyState icon={Wrench} title={tab === "overdue" ? "No overdue services." : "No maintenance records in this view."} />} />
      </Card>
      <ScheduleDialog open={scheduling} onOpenChange={setScheduling} />
      {completing && <CompleteDialog record={completing} onClose={() => setCompleting(null)} />}
    </>
  );
}

const scheduleSchema = z.object({
  truckId: z.string().min(1),
  type: z.enum(MAINTENANCE_TYPES as [MaintenanceType, ...MaintenanceType[]]),
  date: z.string().min(10, "Pick a date"),
  vendor: z.string().trim().min(3, "Workshop / vendor"),
  cost: z.number({ message: "Estimated cost" }).min(0),
  notes: z.string().trim().min(3, "What will be done?"),
});
type ScheduleValues = z.infer<typeof scheduleSchema>;

function ScheduleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const add = useAppStore((s) => s.addMaintenance);
  const trips = useAppStore((s) => s.trips);
  const fuelLogs = useAppStore((s) => s.fuelLogs);
  const form = useForm<ScheduleValues>({ resolver: zodResolver(scheduleSchema), defaultValues: { truckId: "TRK-02", type: "Preventive Maintenance", date: format(addDays(parseISO(TODAY), 3), "yyyy-MM-dd"), vendor: "Hino Service Center, Calamba", cost: 22000, notes: "" } });
  const { control, register, handleSubmit, formState, watch, reset } = form;
  const v = watch();
  const clash = trips.find((t) => t.truckId === v.truckId && t.date === v.date && t.status !== "Cancelled");
  const submit = handleSubmit(async (vals) => {
    const odo = currentOdometer(truckById(vals.truckId), trips, fuelLogs);
    await act(
      () => add({ truckId: vals.truckId, type: vals.type, date: vals.date, vendor: vals.vendor, cost: vals.cost, notes: vals.notes, odometerKm: odo, status: "Scheduled" }),
      (id) => {
        toast.success(`${id} scheduled`, { description: `${truckById(vals.truckId).code} will show as under maintenance on ${fmtDate(vals.date)}.` });
        reset();
        onOpenChange(false);
      },
    );
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule maintenance</DialogTitle>
          <DialogDescription>Dispatch will flag the truck as under maintenance on this date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Truck" htmlFor="m-truck" required>
            <Controller control={control} name="truckId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="m-truck"><SelectValue /></SelectTrigger>
                <SelectContent>{TRUCKS.map((t) => <SelectItem key={t.id} value={t.id}>{t.code} · {t.plateNo}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Type" htmlFor="m-type" required>
            <Controller control={control} name="type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="m-type"><SelectValue /></SelectTrigger>
                <SelectContent>{MAINTENANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Date" htmlFor="m-date" error={formState.errors.date?.message} required>
            <Controller control={control} name="date" render={({ field }) => <DatePicker id="m-date" value={field.value} onChange={field.onChange} minDate={TODAY} />} />
          </Field>
          <Field label="Estimated cost (₱)" htmlFor="m-cost" error={formState.errors.cost?.message}>
            <Input id="m-cost" type="number" min={0} {...register("cost", { valueAsNumber: true })} />
          </Field>
          <Field label="Vendor / workshop" htmlFor="m-vendor" error={formState.errors.vendor?.message} required className="sm:col-span-2">
            <Input id="m-vendor" {...register("vendor")} />
          </Field>
          <Field label="Work to be done" htmlFor="m-notes" error={formState.errors.notes?.message} required className="sm:col-span-2">
            <Textarea id="m-notes" rows={2} {...register("notes")} />
          </Field>
          {clash && (
            <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs sm:col-span-2" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {truckById(v.truckId).code} already has {clash.id} on this date — reassign that trip or pick another day.
            </div>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={formState.isSubmitting}><CalendarClock /> Schedule</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({ record, onClose }: { record: MaintenanceRecord; onClose: () => void }) {
  const setStatus = useAppStore((s) => s.setMaintenanceStatus);
  const [cost, setCost] = React.useState(String(record.cost));
  const [odo, setOdo] = React.useState(String(record.odometerKm));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete {record.id}</DialogTitle>
          <DialogDescription>
            {truckById(record.truckId).code} · {record.type} · {record.vendor}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Final cost (₱)" htmlFor="c-cost">
            <Input id="c-cost" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          <Field label="Odometer at service" htmlFor="c-odo">
            <Input id="c-odo" type="number" value={odo} onChange={(e) => setOdo(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() =>
              void act(
                () => setStatus(record.id, "Completed", { cost: Number(cost) || record.cost, odometerKm: Math.round(Number(odo)) || record.odometerKm, date: record.date > TODAY ? TODAY : record.date }),
                () => {
                  toast.success(`${record.id} completed`, { description: `${peso(Number(cost) || record.cost)} added to ${truckById(record.truckId).code}'s maintenance cost.` });
                  onClose();
                },
              )
            }
          >
            <CheckCircle2 /> Mark completed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
