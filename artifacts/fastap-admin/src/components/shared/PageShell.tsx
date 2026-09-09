import { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/Page";
import { EmptyState as SharedEmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

type Accent = "primary" | "emerald" | "amber" | "rose" | "violet" | "cyan" | "orange";

interface PageShellProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /**
   * Retained so the existing call sites keep compiling, but no longer drawn. A page
   * header that changes hue per screen makes the product read as seven products;
   * every page now opens the same way and colour is left to say something about state.
   */
  accent?: Accent;
  badge?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * The standard page frame: header, then content.
 *
 * The header itself is `PageHeader` from ./Page — this wrapper adds the icon tile,
 * the refresh button and the loading state that its ~18 call sites already pass.
 * New screens should use `PageHeader` directly.
 */
export function PageShell({
  title,
  description,
  icon,
  badge,
  actions,
  loading,
  onRefresh,
  refreshing,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <PageHeader
        title={title}
        description={description}
        badge={badge ? <Badge variant="secondary">{badge}</Badge> : undefined}
        eyebrow={
          icon ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-muted-foreground [&_svg]:size-4">
              {icon}
            </div>
          ) : undefined
        }
        actions={
          <>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                Refresh
              </Button>
            )}
            {actions}
          </>
        }
      />
      {loading ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-24"
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * A titled panel inside a page. Lighter than `<Card>`: no shadow, and the title
 * strip is part of the frame rather than a separate header block.
 */
export function PanelCard({ title, description, action, children, className }: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-md border bg-card text-card-foreground", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold tracking-tight">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

/**
 * Kept as a re-export so the call sites that import `EmptyState` from here keep
 * working. There is one empty state in the product and it lives in ./EmptyState.
 */
export const EmptyState = SharedEmptyState;
