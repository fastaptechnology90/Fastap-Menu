import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff99' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

type PanelSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** guest | restaurant | admin — adjusts focus accent */
  panel?: "guest" | "restaurant" | "admin";
};

/** Styled native &lt;select&gt; for all panels (consistent height, chevron, dark options). */
export function PanelSelect({ className, panel = "restaurant", style, ...props }: PanelSelectProps) {
  return (
    <select
      className={cn(
        "panel-select",
        panel === "guest" && "panel-select--guest",
        panel === "restaurant" && "panel-select--restaurant",
        panel === "admin" && "panel-select--admin",
        className,
      )}
      style={{
        backgroundImage: CHEVRON,
        ...style,
      }}
      {...props}
    />
  );
}
