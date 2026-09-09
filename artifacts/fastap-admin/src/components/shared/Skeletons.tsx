import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders shaped like the content that replaces them, so the page
 * settles into place instead of jumping when the data lands.
 *
 * The frames here use the same `rounded-md border bg-card` as a real Card rather
 * than the admin-only `admin-card-elevated` class they used to, so a skeleton on
 * the restaurant or guest panel is the same shape as what it turns into.
 */

/** Column widths cycle so the block reads as text rather than a grey grid. */
const CELL_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-16", "w-36"];

export function TableSkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <TableCell key={colIndex} className="py-3">
              <Skeleton className={cn("h-4", CELL_WIDTHS[(rowIndex + colIndex) % CELL_WIDTHS.length])} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 4,
  headers,
  className,
}: {
  rows?: number;
  cols?: number;
  /** Real header labels when you have them — keeps the frame recognisable. */
  headers?: string[];
  className?: string;
}) {
  const columnCount = headers?.length ?? cols;
  return (
    <div className={cn("min-w-0 rounded-md border bg-card", className)} aria-busy="true" aria-live="polite">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columnCount }).map((_, index) => (
              <TableHead key={index}>
                {headers?.[index] ?? <Skeleton className="h-3 w-20" />}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeletonRows rows={rows} cols={columnCount} />
        </TableBody>
      </Table>
    </div>
  );
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-md border bg-card p-4 sm:p-6", className)} aria-busy="true">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn("h-3", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Matches the KPI tile grid used at the top of most dashboards. */
export function KpiRowSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-md border bg-card p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-4 rounded-sm" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** The header block, so a page does not pop its title in after its content. */
export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border-b pb-4", className)} aria-busy="true">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-3 w-72 max-w-full" />
    </div>
  );
}

/** A stack of labelled fields, for a form or a settings panel mid-load. */
export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** A list of rows — orders, staff, notifications — on a phone-width screen. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-md border bg-card p-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}
