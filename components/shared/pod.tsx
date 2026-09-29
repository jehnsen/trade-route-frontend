import { AlertTriangle, Camera, FileText, ImageIcon, PenLine } from "lucide-react";
import type { ProofOfDelivery } from "@/types";
import { fmtDateTime, kg } from "@/lib/format";

/** Deterministic fake signature so each POD looks different but stable. */
function Signature({ seed }: { seed: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pts: string[] = [];
  let x = 8;
  for (let i = 0; i < 9; i++) {
    const y = 26 + (((h >> (i * 3)) & 15) - 7) * 1.6;
    const cx = x + 6 + ((h >> i) & 7);
    pts.push(`Q ${cx} ${y - 14 + ((h >> (i + 2)) & 9)} ${x + 14} ${y}`);
    x += 14;
  }
  return (
    <svg viewBox="0 0 150 50" className="h-12 w-full text-slate-700" aria-label="Recipient signature (demo placeholder)">
      <path d={`M 8 28 ${pts.join(" ")}`} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <line x1="6" y1="44" x2="144" y2="44" stroke="currentColor" strokeOpacity={0.25} />
    </svg>
  );
}

export function PodCard({ pod, title, subtitle }: { pod: ProofOfDelivery; title: string; subtitle?: string }) {
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
          <FileText className="size-3" /> {pod.receiptNo}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div className="rounded-md bg-muted/50 px-2">
          {pod.signatureCaptured ? (
            <Signature seed={pod.receivedBy + pod.signedAt} />
          ) : (
            <div className="flex h-12 items-center gap-1.5 text-xs text-muted-foreground">
              <PenLine className="size-3.5" /> No signature captured
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(3, pod.photoCount) }).map((_, i) => (
            <div key={i} className="flex size-12 items-center justify-center rounded-md bg-gradient-to-br from-slate-200 to-slate-100 text-slate-400" aria-label="POD photo placeholder">
              <ImageIcon className="size-4" />
            </div>
          ))}
          {pod.photoCount === 0 && (
            <div className="flex size-12 flex-col items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">
              <Camera className="size-3.5" />
              none
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Received by <span className="font-medium text-foreground">{pod.receivedBy}</span> · {fmtDateTime(pod.signedAt)} · {pod.photoCount} photo{pod.photoCount === 1 ? "" : "s"}
      </div>
      {(pod.damagedKg || pod.shortKg) && (
        <div className="flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs text-[oklch(0.45_0.11_65)]">
          <AlertTriangle className="size-3.5" />
          {pod.damagedKg ? `${kg(pod.damagedKg)} damaged` : ""}
          {pod.damagedKg && pod.shortKg ? " · " : ""}
          {pod.shortKg ? `${kg(pod.shortKg)} short` : ""}
        </div>
      )}
      {pod.customerRemarks && <div className="rounded-md bg-muted/60 px-2 py-1 text-xs"><span className="text-muted-foreground">Consignee: </span>{pod.customerRemarks}</div>}
      {pod.driverNotes && <div className="rounded-md bg-muted/60 px-2 py-1 text-xs"><span className="text-muted-foreground">Driver: </span>{pod.driverNotes}</div>}
    </div>
  );
}
