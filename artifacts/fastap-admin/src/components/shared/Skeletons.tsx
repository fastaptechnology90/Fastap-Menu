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
    <div className={cn("rounded-md border", className)} aria-busy="true" aria-live="polite">
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
    <div className={cn("admin-card-elevated space-y-3 p-5", className)} aria-busy="true">
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
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="admin-card-elevated space-y-3 p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
