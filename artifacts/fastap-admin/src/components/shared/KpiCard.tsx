import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "default" | "primary" | "emerald" | "amber" | "rose" | "violet" | "cyan";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  subtitle?: string;
  /**
   * Retained so the ~40 existing call sites keep compiling, but no longer drawn.
   * A row of tiles in seven different hues says nothing about the numbers on it —
   * inside a KPI tile the only colour that carries meaning is the trend direction.
   */
  accent?: Accent;
}

export function KpiCard({ title, value, icon, trend, subtitle }: KpiCardProps) {
  return (
    <Card className="rounded-md border shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</CardTitle>
        {/* Call sites hand us icons in their own hue. The descendant selector outranks
            those utilities, so the tiles go neutral without touching 40 pages. */}
        {icon && <div className="[&_svg]:size-4 [&_svg]:text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {(trend || subtitle) && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center">
            {trend && (
              <span className={cn("flex items-center mr-2 font-medium tabular-nums", trend.value > 0 ? "text-success" : trend.value < 0 ? "text-danger" : "text-muted-foreground")}>
                {trend.value > 0 ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : trend.value < 0 ? <ArrowDownIcon className="h-3 w-3 mr-1" /> : <MinusIcon className="h-3 w-3 mr-1" />}
                {Math.abs(trend.value)}%
              </span>
            )}
            {trend?.label || subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
