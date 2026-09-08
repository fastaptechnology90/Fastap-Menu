import { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground [&_svg]:size-5 [&_svg]:text-muted-foreground">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
            </div>
            {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} /> Refresh
            </Button>
          )}
          {actions}
        </div>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading data…</p>
        </div>
      ) : children}
    </div>
  );
}

export function PanelCard({ title, description, action, children, className }: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border bg-card text-card-foreground overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
          <div>
            {title && <h3 className="font-semibold text-sm">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    </div>
  );
}
