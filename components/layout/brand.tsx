import { cn } from "@/lib/utils";

export function Logo({
  className,
  tone = "dark",
  storefront = false,
}: {
  className?: string;
  tone?: "dark" | "light";
  storefront?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", storefront && "gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill={storefront ? "#31573e" : tone === "light" ? "#0f5f66" : "#1d8a91"} />
        <path d="M8 21.5c3.5 0 4.5-3 8-3s4.5 3 8 3" stroke="#9be3d9" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M9 14.5h9.5l3.5-4" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.5" cy="10" r="2" fill="#fff" />
      </svg>
      <span className="leading-none">
        <span
          className={cn(
            "block text-[15px] font-bold tracking-tight",
            storefront && "text-[21px] tracking-[-0.06em]",
            tone === "light" ? "text-foreground" : "text-white",
          )}
        >
          TradeLoop<span className={cn(storefront ? "text-[#8dac72]" : "hidden")}>.</span>
        </span>
        <span
          className={cn(
            "block text-[10.5px] font-medium",
            storefront && "mt-1 text-[8px] tracking-[0.11em] uppercase",
            tone === "light" ? "text-muted-foreground" : "text-sidebar-muted",
          )}
        >
          {storefront ? "Wholesale. Delivered." : "Lucena Fresh Trading"}
        </span>
      </span>
    </span>
  );
}
