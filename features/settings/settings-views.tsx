"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BellOff, CheckCheck, Clock, Construction, RotateCcw, Sparkles } from "lucide-react";
import type { NotificationKind } from "@/types";
import { useAppStore } from "@/lib/store";
import { COMPANY, PLATFORM, STAFF, NOW } from "@/data/company";
import { ROUTES, returnLegName } from "@/data/areas";
import { TRUCKS } from "@/data/fleet";
import { FUTURE_MODULES, ROLE_META } from "@/lib/nav";
import { fmtDateTime, kg, peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Switch, Avatar, AvatarFallback } from "@/components/ui/primitives";
import { Field, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/common";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { NotificationRow, useRoleNotifications } from "@/components/layout/notifications-bell";

export function SettingsView() {
  const reset = useAppStore((s) => s.resetDemo);
  return (
    <>
      <PageHeader title="Settings" description={`${PLATFORM.name} configuration for ${COMPANY.name}.`} />
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
          <TabsTrigger value="routes">Routes & fleet</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="demo">Demo data</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Company profile</CardTitle>
                <CardDescription>Printed on delivery receipts, invoices and statements.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  toast.success("Company profile saved");
                }}
              >
                <Field label="Registered business name" htmlFor="s-name">
                  <Input id="s-name" defaultValue={COMPANY.name} />
                </Field>
                <Field label="TIN" htmlFor="s-tin">
                  <Input id="s-tin" defaultValue={COMPANY.tin} />
                </Field>
                <Field label="Address" htmlFor="s-addr" className="sm:col-span-2">
                  <Input id="s-addr" defaultValue={COMPANY.address} />
                </Field>
                <Field label="Landline" htmlFor="s-phone">
                  <Input id="s-phone" defaultValue={COMPANY.phone} />
                </Field>
                <Field label="Mobile / Messenger" htmlFor="s-mobile">
                  <Input id="s-mobile" defaultValue={COMPANY.mobile} />
                </Field>
                <Field label="Orders e-mail" htmlFor="s-email">
                  <Input id="s-email" defaultValue={COMPANY.email} />
                </Field>
                <Field label="Business hours" htmlFor="s-hours">
                  <Input id="s-hours" defaultValue={COMPANY.businessHours} />
                </Field>
                <Field label="Bank account (masked)" htmlFor="s-bank" hint="Only masked numbers are stored in the demo.">
                  <Input id="s-bank" defaultValue={COMPANY.bankAccountMasked} />
                </Field>
                <Field label="GCash (masked)" htmlFor="s-gcash">
                  <Input id="s-gcash" defaultValue={COMPANY.gcashMasked} />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit">Save changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>User</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Mobile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STAFF.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar>
                          <AvatarFallback>{s.initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{s.title}</TableCell>
                    <TableCell>
                      <Badge variant="teal">{ROLE_META[s.role].label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ROLE_META[s.role].description.split("·")[1]?.trim()}</TableCell>
                    <TableCell className="tabular">{s.phone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">Role-based access is simulated in this demo — use the account switcher in the header to preview each role.</p>
          </Card>
        </TabsContent>
        <TabsContent value="routes">
          <div className="grid gap-4">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Route templates</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Outbound</TableHead>
                    <TableHead>Return (backhaul)</TableHead>
                    <TableHead className="text-right">Round trip</TableHead>
                    <TableHead className="text-right">Tolls</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Expected return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ROUTES.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{returnLegName(r)}</TableCell>
                      <TableCell className="text-right tabular">{r.roundTripKm} km</TableCell>
                      <TableCell className="text-right tabular">{peso(r.tollFee)}</TableCell>
                      <TableCell className="tabular">{r.departure}</TableCell>
                      <TableCell className="tabular">{r.expectedReturn}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Fleet payload settings</CardTitle>
                  <CardDescription>Operational payload used for load planning — not the manufacturer&apos;s GVW rating.</CardDescription>
                </div>
              </CardHeader>
              <Table>
                <TableBody>
                  {TRUCKS.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.code}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell className="text-right tabular">{kg(t.capacityKg)} payload</TableCell>
                      <TableCell className="text-right tabular">{t.cargoVolumeCbm} m³</TableCell>
                      <TableCell className="text-right tabular">{t.fuelEfficiencyKmPerL.toFixed(1)} km/L</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t px-4 py-3 text-xs text-muted-foreground">Load weights include ice, styro boxes, banyera and sacks (seafood ×1.6–1.8, shellfish ×1.1, produce ×1.0).</p>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="notifications">
          <Card>
            <CardContent className="grid gap-4 pt-5">
              {[
                ["Orders awaiting confirmation", "Alert sales when a portal or Messenger order is pending for 15+ minutes"],
                ["Late delivery risk", "Alert dispatch when an ETA passes the customer's receiving window"],
                ["Overdue balances", "Daily 7:00 AM digest of overdue accounts to Accounting and the owner"],
                ["Stock below confirmed demand", "Alert procurement when confirmed orders exceed stock + incoming"],
                ["Unused return capacity", "Suggest backhaul when a return leg is below 60% utilization"],
              ].map(([t, d]) => (
                <label key={t} className="flex items-start justify-between gap-4">
                  <span>
                    <span className="block text-sm font-medium">{t}</span>
                    <span className="block text-xs text-muted-foreground">{d}</span>
                  </span>
                  <Switch defaultChecked onCheckedChange={(v) => toast(`${t}: ${v ? "on" : "off"}`)} />
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="demo">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Demo data</CardTitle>
                <CardDescription>Everything in this workspace is fictional sample data for Lucena Fresh Trading & Logistics.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" /> Demo clock fixed at <b>{fmtDateTime(NOW)}</b>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" /> TradeLoop go-live: Aug 26, 2026 — balances before that date were migrated from the paper ledger.
              </div>
              <p className="text-muted-foreground">Orders, payments, POs and leads you create are saved in this browser only. Prices are illustrative, not live market prices.</p>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="justify-self-start">
                    <RotateCcw /> Reset demo data
                  </Button>
                }
                title="Reset all demo data?"
                description="All orders, payments, POs and leads you created in this browser will be discarded."
                confirmLabel="Reset"
                destructive
                onConfirm={() => {
                  reset();
                  toast.success("Demo data reset");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

export function NotificationsCenter() {
  const list = useRoleNotifications();
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAll = useAppStore((s) => s.markAllNotificationsRead);
  const [kind, setKind] = React.useState<NotificationKind | "all" | "unread">("all");
  const shown = list.filter((n) => (kind === "all" ? true : kind === "unread" ? !n.read : n.kind === kind));
  const kinds: { v: typeof kind; l: string }[] = [
    { v: "all", l: "All" },
    { v: "unread", l: "Unread" },
    { v: "order", l: "Orders" },
    { v: "trip", l: "Trips" },
    { v: "finance", l: "Finance" },
    { v: "inventory", l: "Inventory" },
    { v: "procurement", l: "Procurement" },
    { v: "backhaul", l: "Backhaul" },
    { v: "lead", l: "Leads" },
  ];
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alerts generated from today's orders, trips, stock and balances."
        actions={
          <Button variant="outline" onClick={markAll}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button key={k.v} type="button" onClick={() => setKind(k.v)} className={`rounded-full border px-3 py-1 text-xs cursor-pointer ${kind === k.v ? "border-primary bg-accent font-medium text-primary" : "bg-card hover:bg-muted"}`}>
            {k.l}
          </button>
        ))}
      </div>
      <Card className="p-2">
        {shown.length === 0 ? (
          <EmptyState icon={BellOff} title="You're all caught up" description="No notifications in this category." />
        ) : (
          shown.map((n) => (
            <Link key={n.id} href={n.href} onClick={() => markRead(n.id)} className="block">
              <NotificationRow n={n} />
            </Link>
          ))
        )}
      </Card>
    </>
  );
}

export function FutureModuleView({ slug }: { slug: string }) {
  const m = FUTURE_MODULES.find((x) => x.slug === slug);
  if (!m) return <EmptyState title="Module not found" />;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Future Modules" }, { label: m.label }]}
        title={
          <span className="flex items-center gap-2">
            {m.label} <Badge variant="warning">Coming Soon</Badge>
          </span>
        }
        description="Not part of Phase 1. Shown here so the roadmap is clear — nothing on this page is functional."
      />
      <Card className="max-w-3xl border-dashed">
        <CardContent className="grid gap-4 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <m.icon className="size-6" />
            </span>
            <p className="text-sm">{m.summary}</p>
          </div>
          <ul className="grid gap-2 text-sm">
            {m.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Construction className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {b}
              </li>
            ))}
          </ul>
          <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">Phase 1 focuses on digitizing today&apos;s operation: orders from every channel, dispatch, deliveries, procurement, backhaul, collections and reporting.</p>
        </CardContent>
      </Card>
    </>
  );
}
