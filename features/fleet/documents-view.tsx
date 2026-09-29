"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { addYears, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileCheck2, FileText, Paperclip, RefreshCw, Timer } from "lucide-react";
import type { VehicleDocument } from "@/types";
import { useAppStore } from "@/lib/store";
import { TODAY } from "@/data/company";
import { TRUCKS, DRIVERS, truckById, driverById } from "@/data/fleet";
import { documentStatus } from "@/lib/logistics";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/primitives";
import { DatePicker, Field } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, KPICard, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

const ownerLabel = (d: VehicleDocument) => (d.truckId ? `${truckById(d.truckId).code} · ${truckById(d.truckId).plateNo}` : d.driverId ? driverById(d.driverId).name : "—");

export function DocumentsView() {
  const docs = useAppStore((s) => s.documents);
  const [owner, setOwner] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [renewing, setRenewing] = React.useState<VehicleDocument | null>(null);

  const rows = docs.map((d) => ({ doc: d, ...documentStatus(d) }));
  const filtered = rows.filter((r) => (owner === "all" || r.doc.truckId === owner || r.doc.driverId === owner) && (status === "all" || r.status === status));
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  const columns: ColumnDef<(typeof rows)[number], unknown>[] = [
    { id: "type", header: "Document", accessorFn: (r) => r.doc.type, cell: ({ row }) => <div><div className="font-medium">{row.original.doc.type}</div><div className="text-xs text-muted-foreground">{row.original.doc.id}</div></div> },
    { id: "owner", header: "Truck / driver", accessorFn: (r) => ownerLabel(r.doc), cell: ({ row }) => <span className="whitespace-nowrap">{ownerLabel(row.original.doc)}</span> },
    { id: "ref", header: "Reference", accessorFn: (r) => r.doc.reference, cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap">{row.original.doc.reference}</span> },
    { id: "issuer", header: "Issuer", accessorFn: (r) => r.doc.issuer, cell: ({ row }) => <span className="block max-w-[200px] truncate text-muted-foreground">{row.original.doc.issuer}</span> },
    { id: "issued", header: "Issued", accessorFn: (r) => r.doc.issueDate, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.doc.issueDate)}</span> },
    { id: "expiry", header: "Expiry", accessorFn: (r) => r.doc.expiryDate, cell: ({ row }) => <div className="whitespace-nowrap">{fmtDate(row.original.doc.expiryDate)}<div className={row.original.daysLeft < 0 ? "text-xs font-medium text-danger" : row.original.daysLeft <= 30 ? "text-xs font-medium text-[oklch(0.55_0.13_65)]" : "text-xs text-muted-foreground"}>{row.original.daysLeft < 0 ? `expired ${-row.original.daysLeft} days ago` : `${row.original.daysLeft} days left`}</div></div> },
    { id: "status", header: "Status", accessorFn: (r) => r.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "file", header: "Attachment", accessorFn: (r) => r.doc.attachment ?? "", cell: ({ row }) => (row.original.doc.attachment ? <span className="inline-flex items-center gap-1 text-xs"><Paperclip className="size-3.5 text-muted-foreground" /> {row.original.doc.attachment}</span> : <span className="text-xs text-muted-foreground">No file</span>) },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Button size="sm" variant={row.original.status === "Valid" ? "ghost" : "outline"} onClick={() => setRenewing(row.original.doc)}>
          <RefreshCw /> Renew
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Vehicle Documents" description="OR/CR, registration, insurance, emission tests, franchise and driver requirements — with expiry tracking so no truck is stopped at a checkpoint." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Expired" value={count("Expired")} icon={AlertTriangle} tone={count("Expired") ? "danger" : "success"} hint={rows.filter((r) => r.status === "Expired").map((r) => `${r.doc.type} (${ownerLabel(r.doc).split(" · ")[0]})`).join(" · ") || "None"} />
        <KPICard label="Expiring within 30 days" value={count("Expiring Soon")} icon={Timer} tone={count("Expiring Soon") ? "warning" : "success"} hint={rows.filter((r) => r.status === "Expiring Soon").map((r) => `${r.doc.type}`).join(" · ") || "None"} />
        <KPICard label="Valid" value={count("Valid")} icon={CheckCircle2} tone="success" />
        <KPICard label="Missing attachments" value={rows.filter((r) => !r.doc.attachment).length} icon={FileText} hint="scan and attach for audits" />
      </div>
      <Card className="overflow-hidden">
        <FilterBar search={q} onSearch={setQ} placeholder="Search document, reference, issuer…">
          <FilterSelect value={owner} onChange={setOwner} label="Truck or driver" className="w-full sm:w-56" options={[{ value: "all", label: "All trucks & drivers" }, ...TRUCKS.map((t) => ({ value: t.id, label: t.code })), ...DRIVERS.map((d) => ({ value: d.id, label: d.name }))]} />
          <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "all", label: "Any status" }, { value: "Expired", label: "Expired" }, { value: "Expiring Soon", label: "Expiring soon" }, { value: "Valid", label: "Valid" }]} />
        </FilterBar>
        <DataTable
          columns={columns}
          data={filtered}
          search={q}
          searchText={(r) => `${r.doc.type} ${r.doc.reference} ${r.doc.issuer} ${ownerLabel(r.doc)}`}
          initialSorting={[{ id: "expiry", desc: false }]}
          empty={<EmptyState icon={FileCheck2} title="No documents match these filters." />}
          renderCard={(r) => (
            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.doc.type}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                {ownerLabel(r.doc)} · until {fmtDate(r.doc.expiryDate)}
              </div>
            </div>
          )}
        />
      </Card>
      {renewing && <RenewDialog doc={renewing} onClose={() => setRenewing(null)} />}
    </>
  );
}

function RenewDialog({ doc, onClose }: { doc: VehicleDocument; onClose: () => void }) {
  const renew = useAppStore((s) => s.renewDocument);
  const [reference, setReference] = React.useState(doc.reference);
  const [issueDate, setIssueDate] = React.useState(TODAY);
  const [expiryDate, setExpiryDate] = React.useState(format(addYears(parseISO(doc.expiryDate < TODAY ? TODAY : doc.expiryDate), 1), "yyyy-MM-dd"));
  const [file, setFile] = React.useState<string>(doc.attachment ?? "");
  const [error, setError] = React.useState<string>();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew {doc.type}</DialogTitle>
          <DialogDescription>{ownerLabel(doc)} · currently valid until {fmtDate(doc.expiryDate)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New reference" htmlFor="r-ref" hint="Mask sensitive numbers" className="sm:col-span-2">
            <Input id="r-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Issue date" htmlFor="r-issue">
            <DatePicker id="r-issue" value={issueDate} onChange={setIssueDate} />
          </Field>
          <Field label="Expiry date" htmlFor="r-exp" error={error}>
            <DatePicker id="r-exp" value={expiryDate} onChange={setExpiryDate} minDate={TODAY} />
          </Field>
          <Field label="Attachment (demo — file name only)" htmlFor="r-file" className="sm:col-span-2">
            <Input id="r-file" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0]?.name ?? file)} />
          </Field>
          {file && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
              <Paperclip className="size-3.5" /> {file}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (expiryDate <= issueDate) return setError("Expiry must be after the issue date");
              renew(doc.id, { reference, issueDate, expiryDate, attachment: file || undefined });
              toast.success(`${doc.type} renewed`, { description: `Valid until ${fmtDate(expiryDate)}` });
              onClose();
            }}
          >
            <RefreshCw /> Save renewal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
