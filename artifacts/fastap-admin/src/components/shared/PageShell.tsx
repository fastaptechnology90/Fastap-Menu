import { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Accent = "primary" | "emerald" | "amber" | "rose" | "violet" | "cyan" | "orange";

const accentMap: Record<Accent, string> = {
  primary: "from-primary/20 via-primary/5 to-transparent border-primary/20",
  emerald: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/20",
  amber: "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/20",
  rose: "from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/20",
  violet: "from-violet-500/20 via-violet-500/5 to-transparent border-violet-500/20",
  cyan: "from-cyan-500/20 via-cyan-500/5 to-transparent border-cyan-500/20",
  orange: "from-orange-500/20 via-orange-500/5 to-transparent border-orange-500/20",
};

const iconBg: Record<Accent, string> = {
  primary: "bg-primary/15 text-primary",
  emerald: "bg-emerald-500/15 text-emerald-500",
  amber: "bg-amber-500/15 text-amber-500",
  rose: "bg-rose-500/15 text-rose-500",
  violet: "bg-violet-500/15 text-violet-500",
  cyan: "bg-cyan-500/15 text-cyan-500",
  orange: "bg-orange-500/15 text-orange-500",
};

interface PageShellProps {
  title: string;
  description?: string;
  icon?: ReactNode;
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
  accent = "primary",
  badge,
  actions,
  loading,
  onRefresh,
  refreshing,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn("space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500", className)}>
      <div className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 sm:p-6 shadow-sm", accentMap[accent])}>
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {icon && (
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconBg[accent])}>
                {icon}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
                {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
              </div>
              {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
              <Button variant="outline" size="sm" className="rounded-xl bg-background/60 backdrop-blur" onClick={onRefresh} disabled={refreshing}>
                <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} /> Refresh
              </Button>
            )}
            {actions}
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
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
    <div className={cn("admin-card-elevated overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b bg-muted/30">
          <div>
            {title && <h3 className="font-semibold text-sm">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    </div>
  );
}
