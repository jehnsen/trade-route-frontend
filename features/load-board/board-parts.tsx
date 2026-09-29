"use client";

import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { BoardMatch, MatchCheck } from "@/lib/load-board";
import { copyText, cn } from "@/lib/utils";

/** Copy a GC-ready message and confirm with a toast. No Messenger/Viber/Facebook integration. */
export async function copyShareMessage(text: string) {
  if (await copyText(text)) toast.success("Share message copied", { description: "Paste it in the Messenger / Viber GC or Facebook group." });
  else toast.error("Could not copy — your browser blocked clipboard access.");
}

const CHECK_ICON = { ok: CheckCircle2, partial: AlertTriangle, fail: XCircle } as const;
const CHECK_TONE = { ok: "text-[oklch(0.45_0.13_150)]", partial: "text-[oklch(0.55_0.13_65)]", fail: "text-danger" } as const;

/** The rule-by-rule explanation behind a match label. */
export function MatchChecks({ checks, className }: { checks: MatchCheck[]; className?: string }) {
  return (
    <ul className={cn("grid gap-1 text-xs", className)}>
      {checks.map((c) => {
        const Icon = CHECK_ICON[c.result];
        return (
          <li key={c.rule} className="flex items-start gap-1.5">
            <Icon className={cn("mt-px size-3.5 shrink-0", CHECK_TONE[c.result])} aria-hidden />
            <span>
              <span className="sr-only">{c.result === "ok" ? "OK: " : c.result === "partial" ? "Check: " : "Problem: "}</span>
              {c.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Compact "2 strong · 1 possible" summary used in tables; a button that opens the match list. */
export function MatchCount({ matches, onOpen, disabled }: { matches: BoardMatch[] | undefined; onOpen: () => void; disabled?: boolean }) {
  const strong = matches?.filter((m) => m.label === "Strong Match").length ?? 0;
  const possible = matches?.filter((m) => m.label === "Possible Match").length ?? 0;
  if (disabled) return <span className="text-xs text-muted-foreground">—</span>;
  if (!strong && !possible)
    return (
      <button type="button" onClick={onOpen} className="cursor-pointer text-xs text-muted-foreground hover:underline">
        No fit yet
      </button>
    );
  return (
    <button type="button" onClick={onOpen} className="inline-flex cursor-pointer flex-wrap items-center gap-1 text-xs font-medium whitespace-nowrap text-primary hover:underline">
      {strong > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-[oklch(0.42_0.12_150)]">
          <CheckCircle2 className="size-3" /> {strong} strong
        </span>
      )}
      {possible > 0 && <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[oklch(0.48_0.12_65)]">{possible} possible</span>}
    </button>
  );
}
