import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The frame a table lives in: a bordered card whose contents scroll sideways
 * inside it, never taking the page with them.
 *
 * `<Table>` already owns its own scroll container. This adds the frame, the
 * optional header strip above it, and the rounded overflow clip — the three
 * things every list screen currently spells out by hand, usually as
 * `rounded-xl border overflow-hidden`, which clips the scrollbar.
 *
 * `overflow-hidden` on the frame would hide the horizontal scrollbar and leave the
 * user with no indication the table continues; the frame therefore clips nothing
 * and the inner container does the scrolling.
 */
export function TableShell({
  header,
  footer,
  children,
  className,
}: {
  /** Title strip or toolbar above the table, inside the same frame. */
  header?: ReactNode;
  /** Pagination or totals below the table, inside the same frame. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-md border bg-card", className)}>
      {header && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          {header}
        </div>
      )}
      <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Wrap the cell content of a column that must not be squeezed — an amount, a
 * date, a status chip — so the browser gives the width to the prose columns
 * instead.
 */
export function TableCellNoWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("whitespace-nowrap", className)}>{children}</span>;
}

/**
 * Right-aligned tabular figures. Money and counts belong in a column that lines
 * up on the decimal, and `tabular-nums` stops the row twitching when a digit
 * changes on a live screen.
 */
export function TableNumeric({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("block text-right font-medium tabular-nums", className)}>{children}</span>
  );
}
