"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pesoCompact, peso, num } from "@/lib/format";

export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];
const GRID = "var(--chart-grid)";
const AXIS = "var(--chart-axis)";
const tick = { fill: AXIS, fontSize: 11 };

type Fmt = (v: number) => string;

function ChartTooltip({ active, payload, label, valueFormat, labelFormat }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string; payload: Record<string, unknown> }[]; label?: string; valueFormat: Fmt; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <div className="mb-1 font-medium">{labelFormat ? labelFormat(String(label)) : label}</div>}
      <div className="grid gap-0.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold tabular">{valueFormat(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendArea({
  data,
  xKey,
  series,
  height = 260,
  valueFormat = pesoCompact,
  labelFormat,
  xFormat,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; name: string; color?: string }[];
  height?: number;
  valueFormat?: Fmt;
  labelFormat?: (l: string) => string;
  xFormat?: (l: string) => string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? SERIES[i]} stopOpacity={0.18} />
                <stop offset="100%" stopColor={s.color ?? SERIES[i]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={tick} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={xFormat} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => valueFormat(Number(v))} width={56} />
          <Tooltip cursor={{ stroke: AXIS, strokeDasharray: "0", strokeWidth: 1 }} content={<ChartTooltip valueFormat={valueFormat} labelFormat={labelFormat} />} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
          {series.map((s, i) => (
            <Area isAnimationActive={false} key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? SERIES[i]} strokeWidth={2} fill={`url(#grad-${s.key})`} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLines({ data, xKey, series, height = 260, valueFormat = num, xFormat, labelFormat, domain }: { data: Record<string, unknown>[]; xKey: string; series: { key: string; name: string; color?: string }[]; height?: number; valueFormat?: Fmt; xFormat?: (l: string) => string; labelFormat?: (l: string) => string; domain?: [number, number] }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={tick} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={xFormat} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => valueFormat(Number(v))} width={48} domain={domain} />
          <Tooltip cursor={{ stroke: AXIS, strokeWidth: 1 }} content={<ChartTooltip valueFormat={valueFormat} labelFormat={labelFormat} />} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
          {series.map((s, i) => (
            <Line isAnimationActive={false} key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Columns({
  data,
  xKey,
  series,
  height = 260,
  valueFormat = pesoCompact,
  xFormat,
  labelFormat,
  stacked,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; name: string; color?: string }[];
  height?: number;
  valueFormat?: Fmt;
  xFormat?: (l: string) => string;
  labelFormat?: (l: string) => string;
  stacked?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={tick} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={xFormat} minTickGap={8} />
          <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => valueFormat(Number(v))} width={56} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip valueFormat={valueFormat} labelFormat={labelFormat} />} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
          {series.map((s, i) => (
            <Bar isAnimationActive={false} key={s.key} dataKey={s.key} name={s.name} fill={s.color ?? SERIES[i]} maxBarSize={24} radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]} stackId={stacked ? "a" : undefined} stroke={stacked ? "var(--card)" : undefined} strokeWidth={stacked ? 1 : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars — ranked magnitudes with labels (product mix, top customers). */
export function RankedBars({ data, valueFormat = peso, height, color = SERIES[0], colorBy }: { data: { label: string; value: number; sub?: string }[]; valueFormat?: Fmt; height?: number; color?: string; colorBy?: (label: string, i: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="grid gap-2.5" style={height ? { maxHeight: height, overflowY: "auto" } : undefined}>
      {data.map((d, i) => (
        <li key={d.label} className="grid gap-1 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate">
              {d.label}
              {d.sub && <span className="ml-1.5 text-xs text-muted-foreground">{d.sub}</span>}
            </span>
            <span className="shrink-0 text-[13px] font-medium tabular">{valueFormat(d.value)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-2 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: colorBy ? colorBy(d.label, i) : color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HBarChart({ data, height = 280, valueFormat = pesoCompact, colors }: { data: { label: string; value: number }[]; height?: number; valueFormat?: Fmt; colors?: string[] }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => valueFormat(Number(v))} />
          <YAxis type="category" dataKey="label" tick={{ ...tick, fill: "var(--foreground)" }} tickLine={false} axisLine={false} width={110} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip valueFormat={valueFormat} />} />
          <Bar isAnimationActive={false} dataKey="value" name="Value" maxBarSize={20} radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors?.[i] ?? SERIES[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legendary({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
