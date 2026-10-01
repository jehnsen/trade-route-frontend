"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Clock3, GripVertical, MapPin, Route } from "lucide-react";
import type { Lead, LeadStage } from "@/types";
import { staffById } from "@/data/company";
import { fmtDateShort, pesoCompact } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DND = "application/x-tradeloop-lead";
const STAGE_COLORS: Record<LeadStage, string> = {
  New: "#6686a5", Contacted: "#4a858d", Quoted: "#a47a32", "Sample Order": "#7d72a3", Negotiating: "#3c7666", Won: "#398353", Lost: "#9a6470",
};

export function LeadPipeline({ leads, stages, onOpen, onMove }: {
  leads: Lead[];
  stages: LeadStage[];
  onOpen: (id: string) => void;
  onMove: (id: string, stage: LeadStage) => void;
}) {
  const board = React.useRef<HTMLDivElement>(null);
  const [over, setOver] = React.useState<LeadStage | null>(null);
  const [canBack, setCanBack] = React.useState(false);
  const [canForward, setCanForward] = React.useState(false);
  const updateScroll = React.useCallback(() => {
    const el = board.current;
    if (!el) return;
    setCanBack(el.scrollLeft > 1);
    setCanForward(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);
  React.useEffect(() => {
    const el = board.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(el);
    updateScroll();
    return () => observer.disconnect();
  }, [updateScroll, stages.length]);
  const scroll = (direction: number) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    board.current?.scrollBy({ left: direction * 296, behavior: reduced ? "instant" : "smooth" });
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">Drag between stages, or open a lead and choose Move stage.</p>
        <div className="flex shrink-0 gap-1"><Button variant="outline" size="icon-sm" aria-label="Previous pipeline stages" disabled={!canBack} onClick={() => scroll(-1)}><ArrowLeft /></Button><Button variant="outline" size="icon-sm" aria-label="Next pipeline stages" disabled={!canForward} onClick={() => scroll(1)}><ArrowRight /></Button></div>
      </div>
      <div ref={board} onScroll={updateScroll} role="region" aria-label="Lead pipeline" tabIndex={0} className="lead-pipeline flex items-start gap-3 overflow-x-auto pb-4 scrollbar-thin">
        {stages.map((stage) => {
          const list = leads.filter((lead) => lead.stage === stage);
          return (
            <section key={stage} aria-label={`${stage} leads`} className={cn("lead-stage flex w-[284px] max-w-[calc(100cqw-2px)] shrink-0 flex-col rounded-xl border bg-muted/45", over === stage && "border-primary bg-accent ring-1 ring-primary/20")}
              onDragOver={(e) => { if (e.dataTransfer.types.includes(DND)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(stage); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData(DND); if (leads.some((lead) => lead.id === id && lead.stage !== stage)) onMove(id, stage); }}>
              <div className="border-b px-3.5 py-3.5"><div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-xs font-semibold"><span className="size-2 rounded-full" style={{background:STAGE_COLORS[stage]}} />{stage}</h3><span className="rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground tabular">{list.length}</span></div><div className="mt-2 text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{pesoCompact(sumBy(list, (lead) => lead.potentialMonthlyValue))}</span> / month potential</div></div>
              <div className="grid gap-2.5 p-2.5">
                {list.map((lead) => {
                  const owner = staffById(lead.ownerId);
                  return (
                    <button key={lead.id} type="button" draggable onDragStart={(e) => { e.dataTransfer.setData(DND,lead.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setOver(null)} onClick={() => onOpen(lead.id)} aria-label={`Open ${lead.businessName}`} className="lead-pipeline-card grid cursor-grab gap-3 rounded-lg border bg-card p-3.5 text-left shadow-xs transition-colors hover:border-primary/40 active:cursor-grabbing">
                      <div><div className="mb-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground"><span>{lead.id}</span><GripVertical className="size-3.5 opacity-60" /></div><div className="text-[13px] font-semibold leading-relaxed">{lead.businessName}</div><div className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground"><MapPin className="mt-0.5 size-3 shrink-0" />{lead.location}</div></div>
                      <div className="rounded-md bg-accent/45 p-2.5"><div className="flex items-start gap-1.5 text-[11px] font-medium"><Route className="mt-0.5 size-3 shrink-0 text-primary" />{lead.lane}</div><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{lead.cargoInterest}</p></div>
                      <div><div className="text-sm font-semibold text-primary tabular">{pesoCompact(lead.potentialMonthlyValue)}<span className="ml-1 text-[10px] font-normal text-muted-foreground">/ month</span></div><div className="mt-1 text-[10px] text-muted-foreground">{lead.potentialVolume}</div></div>
                      <Badge variant="outline" className="max-w-full whitespace-normal text-left text-[10px]">{lead.source}</Badge>
                      <div className="flex items-center justify-between gap-2 border-t pt-2.5"><span title={owner?.name} aria-label={`Owner: ${owner?.name ?? "Unassigned"}`} className="flex size-6 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-primary">{owner?.initials ?? "—"}</span><span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="size-3" />Contacted {fmtDateShort(lead.lastContactAt)}</span></div>
                    </button>
                  );
                })}
                {list.length === 0 && <div className="rounded-lg border border-dashed bg-card/50 px-3 py-7 text-center text-[11px] text-muted-foreground">No leads here. Drop a lead to move it.</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
