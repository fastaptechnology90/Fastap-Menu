import { useEffect, useId, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeletonRows } from "@/components/shared/Skeletons";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  RefreshCw,
  Search,
} from "lucide-react";

export interface DataTableColumn<T> {
  /** Usually a label; some tables put a select-all checkbox here. */
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  /** Opt in to header-click sorting for this column. */
  sortable?: boolean;
  /** Value to sort on when the cell renders something other than the raw field. */
  sortValue?: (item: T) => string | number | Date | null | undefined;
  /** Text to match on when searching, for the same reason. */
  searchValue?: (item: T) => string | number | null | undefined;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pageSize?: number;
  keyExtractor?: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  /** Renders a skeleton of rows rather than an empty table. */
  loading?: boolean;
  /** Anything truthy switches the table to its failure state. */
  error?: unknown;
  onRetry?: () => void;
  errorMessage?: string;
  /** Replaces the whole empty state. */
  empty?: React.ReactNode;
  emptyMessage?: string;
  emptyDescription?: string;
  /** Shows a search box that filters across the columns. */
  searchable?: boolean;
  searchPlaceholder?: string;
}

type SortDirection = "asc" | "desc";

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);

  const left = String(a);
  const right = String(b);
  // Amounts and counts often arrive as strings; sort them as the numbers they are.
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && left.trim() !== "" && right.trim() !== "") {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function columnSortValue<T>(column: DataTableColumn<T>, row: T): unknown {
  if (column.sortValue) return column.sortValue(row);
  return column.accessorKey ? row[column.accessorKey] : undefined;
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  keyExtractor,
  onRowClick,
  loading,
  error,
  onRetry,
  errorMessage = "We couldn't load this list.",
  empty,
  emptyMessage = "Nothing here yet",
  emptyDescription,
  searchable,
  searchPlaceholder = "Search…",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ index: number; direction: SortDirection } | null>(null);
  const searchInputId = useId();

  // Columns rendered entirely through `cell` expose no text to match on, so
  // those tables fall back to the row's own primitive fields.
  const searchesRowFields = useMemo(
    () => !columns.some((column) => column.searchValue || column.accessorKey),
    [columns],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((row) => {
      const haystack = searchesRowFields
        ? Object.values(row as Record<string, unknown>)
            .filter((value) => typeof value === "string" || typeof value === "number")
            .join(" ")
        : columns
            .map((column) => {
              if (column.searchValue) return column.searchValue(row) ?? "";
              return column.accessorKey ? (row[column.accessorKey] as unknown) ?? "" : "";
            })
            .join(" ");
      return String(haystack).toLowerCase().includes(needle);
    });
  }, [columns, data, query, searchesRowFields]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns[sort.index];
    if (!column?.sortable) return filtered;
    return [...filtered].sort((a, b) => {
      const left = columnSortValue(column, a);
      const right = columnSortValue(column, b);
      // Blanks stay at the bottom whichever way the column is sorted.
      if (isBlank(left) || isBlank(right)) {
        if (isBlank(left) && isBlank(right)) return 0;
        return isBlank(left) ? 1 : -1;
      }
      return sort.direction === "asc" ? compareValues(left, right) : compareValues(right, left);
    });
  }, [columns, filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  // Filtering a long list used to strand the user on a page that no longer exists.
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * pageSize;
  const paginatedData = sorted.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, query, pageSize]);

  const getRowKey = (item: T, index: number): string | number =>
    keyExtractor ? keyExtractor(item) : (item as { id?: string | number })?.id ?? index;

  function toggleSort(index: number) {
    setSort((current) => {
      if (current?.index !== index) return { index, direction: "asc" };
      if (current.direction === "asc") return { index, direction: "desc" };
      return null;
    });
  }

  const columnCount = columns.length;
  const showFooter = !loading && !error && totalPages > 1;

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative max-w-sm">
          <label htmlFor={searchInputId} className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchInputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, idx) => {
                const active = sort?.index === idx;
                const ariaSort = !col.sortable
                  ? undefined
                  : active
                  ? sort.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
                return (
                  <TableHead key={idx} aria-sort={ariaSort}>
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(idx)}
                        className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {col.header}
                        {active ? (
                          sort.direction === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeletonRows rows={Math.min(pageSize, 6)} cols={columnCount} />
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="h-40">
                  <div role="alert" className="flex flex-col items-center justify-center gap-2 text-center">
                    <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
                    <p className="text-sm font-medium">{errorMessage}</p>
                    <p className="text-xs text-muted-foreground">
                      This is a problem loading the data, not an empty list.
                    </p>
                    {onRetry && (
                      <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Try again
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <TableRow
                  key={getRowKey(row, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                >
                  {columns.map((col, colIndex) => (
                    <TableCell key={colIndex}>
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                        ? (row[col.accessorKey] as React.ReactNode)
                        : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="h-40 p-0">
                  {query && data.length > 0 ? (
                    <EmptyState
                      icon={<Search className="h-6 w-6" aria-hidden="true" />}
                      title="No matches"
                      description={`Nothing in this list matches “${query.trim()}”.`}
                      action={
                        <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                          Clear search
                        </Button>
                      }
                      className="py-10"
                    />
                  ) : (
                    empty ?? (
                      <EmptyState title={emptyMessage} description={emptyDescription} className="py-10" />
                    )
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showFooter && (
        <div className="flex items-center justify-end space-x-2">
          <div className="flex-1 text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, sorted.length)} of {sorted.length} entries
            {query && data.length !== sorted.length ? ` (filtered from ${data.length})` : ""}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(() => Math.max(1, page - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(() => Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
