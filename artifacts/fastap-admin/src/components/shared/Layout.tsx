import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Responsive layout helpers.
 *
 * The four widths that matter here: 375 (a diner's phone), 768 (a floor tablet in
 * portrait), 1024 (the same tablet in landscape, and the smallest laptop) and
 * 1440. Tailwind's `sm`/`md`/`lg`/`xl` land at 640/768/1024/1280, so `sm:` is the
 * phone-to-tablet break and `lg:` is the tablet-to-desktop one.
 *
 * These exist so a page states its intent — "three tiles, wrapping" — rather than
 * restating a different grid on every screen. Nearly every dashboard in this
 * product spells its KPI grid slightly differently.
 */

type GridCols = 2 | 3 | 4;

const GRID_COLS: Record<GridCols, string> = {
  // Two columns even at 375px: KPI tiles are short, and one per row wastes the
  // screen and pushes the actual content below the fold.
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function AutoGrid({
  cols = 4,
  children,
  className,
}: {
  /** Columns at the widest breakpoint. Always halves or thirds on the way down. */
  cols?: GridCols;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-3 sm:gap-4", GRID_COLS[cols], className)}>{children}</div>;
}

/**
 * A main column with a sidebar that becomes a second row on anything narrower
 * than a laptop. The sidebar goes first in the DOM only if you put it first —
 * on mobile, order follows source, so put the primary content first.
 */
export function SplitLayout({
  main,
  aside,
  className,
}: {
  main: ReactNode;
  aside: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-3", className)}>
      <div className="min-w-0 lg:col-span-2">{main}</div>
      <div className="min-w-0">{aside}</div>
    </div>
  );
}

/**
 * A horizontally scrolling strip — filter chips, a date row, status tabs.
 *
 * `min-w-0` on the wrapper is what keeps this from widening its parent instead of
 * scrolling: inside a flex or grid parent the default `min-width: auto` lets a
 * child refuse to shrink below its content, and the whole page ends up scrolling
 * sideways. This is the single most common cause of that here.
 */
export function ScrollX({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "-mx-1 flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 no-scrollbar",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Vertical stack with the product's standard gaps. `tight` for items inside a
 * card, `default` between blocks, `loose` between the major parts of a page.
 */
export function Stack({
  gap = "default",
  children,
  className,
}: {
  gap?: "tight" | "default" | "loose";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col",
        gap === "tight" && "gap-2",
        gap === "default" && "gap-4",
        gap === "loose" && "gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * A horizontal group that wraps instead of overflowing. For button groups, chip
 * rows, and metadata lines — anywhere the count of items is not fixed.
 */
export function Cluster({
  gap = "default",
  children,
  className,
}: {
  gap?: "tight" | "default";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center", gap === "tight" ? "gap-1.5" : "gap-2", className)}>
      {children}
    </div>
  );
}
