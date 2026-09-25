"use client";

import * as React from "react";
import { Select as SelectPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { Command as CommandPrimitive } from "cmdk";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { CalendarIcon, CheckIcon, ChevronDownIcon, ChevronLeft, ChevronRight, ChevronsUpDown, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./overlays";

// ─── Select ─────────────────────────────────────────────────────────────────
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;
export function SelectTrigger({ className, children, size = "default", ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring/40 flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm whitespace-nowrap shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
export function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-lg border shadow-lg",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport className={cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1")}>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}
export function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)} {...props} />;
}
export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn("focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────
export function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-3", className)} {...props} />;
}
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn("bg-muted text-muted-foreground inline-flex h-9 w-fit max-w-full items-center justify-start overflow-x-auto rounded-lg p-[3px] scrollbar-thin", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-card data-[state=active]:text-foreground focus-visible:ring-ring/50 inline-flex h-[calc(100%-1px)] flex-none items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-[13px] font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:size-4 cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}
export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}

// ─── Command (cmdk) ─────────────────────────────────────────────────────────
export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive className={cn("bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md", className)} {...props} />;
}
export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-11 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input className={cn("placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
    </div>
  );
}
export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn("max-h-[min(60vh,420px)] scroll-py-1 overflow-x-hidden overflow-y-auto", className)} {...props} />;
}
export function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground" {...props} />;
}
export function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group className={cn("text-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium", className)} {...props} />;
}
export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn("data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-muted-foreground", className)}
      {...props}
    />
  );
}
export function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className={cn("bg-border -mx-1 h-px", className)} {...props} />;
}

// ─── Combobox (searchable select) ───────────────────────────────────────────
export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
  keywords?: string[];
}
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className,
  invalid,
  id,
}: {
  options: ComboOption[];
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            "border-input aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring/40 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-card px-3 text-left text-sm shadow-xs outline-none focus-visible:ring-[3px] cursor-pointer",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""} ${(o.keywords ?? []).join(" ")}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn("size-4", o.value === value ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <div className="truncate">{o.label}</div>
                    {o.hint && <div className="truncate text-xs text-muted-foreground">{o.hint}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Calendar & date picker ─────────────────────────────────────────────────
export function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex h-8 items-center justify-center text-sm font-medium",
        nav: "absolute inset-x-2 top-2 flex items-center justify-between",
        button_previous: "inline-flex size-8 items-center justify-center rounded-md hover:bg-accent cursor-pointer",
        button_next: "inline-flex size-8 items-center justify-center rounded-md hover:bg-accent cursor-pointer",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 text-[11px] font-medium",
        week: "mt-1 flex w-full",
        day: "size-9 p-0 text-center text-sm",
        day_button: "inline-flex size-9 items-center justify-center rounded-md hover:bg-accent cursor-pointer aria-selected:bg-primary aria-selected:text-primary-foreground",
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        today: "[&>button]:font-semibold [&>button]:ring-1 [&>button]:ring-primary/40",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/40 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        root: "relative",
      }}
      components={{
        Chevron: ({ orientation }) => (orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />),
      }}
      {...props}
    />
  );
}

export function DatePicker({ value, onChange, minDate, id, invalid, className }: { value?: string; onChange: (iso: string) => void; minDate?: string; id?: string; invalid?: boolean; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" aria-invalid={invalid} className={cn("w-full justify-start font-normal aria-invalid:border-destructive", !value && "text-muted-foreground", className)}>
          <CalendarIcon className="size-4 opacity-60" />
          {selected ? format(selected, "EEE, MMM d, yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? (minDate ? parseISO(minDate) : undefined)}
          disabled={minDate ? { before: parseISO(minDate) } : undefined}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Form field wrapper ─────────────────────────────────────────────────────
export function Field({ label, htmlFor, error, hint, children, className, required }: { label: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium leading-none">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
