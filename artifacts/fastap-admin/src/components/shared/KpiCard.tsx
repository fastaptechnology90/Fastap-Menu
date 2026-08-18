import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "default" | "primary" | "emerald" | "amber" | "rose" | "violet" | "cyan";

const accentStyles: Record<Accent, string> = {
  default: "",
  primary: "border-primary/20 bg-gradient-to-br from-primary/5 to-card",
  emerald: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-card",
  amber: "border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-card",
  rose: "border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-card",
  violet: "border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-card",
  cyan: "border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-card",
};

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  subtitle?: string;
  accent?: Accent;
}

export function KpiCard({ title, value, icon, trend, subtitle, accent = "default" }: KpiCardProps) {
  return (
    <Card className={cn("admin-card-elevated transition-all hover:shadow-md", accentStyles[accent])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="rounded-lg bg-background/80 p-1.5 shadow-sm">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {(trend || subtitle) && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center">
            {trend && (
              <span className={cn("flex items-center mr-2 font-medium", trend.value > 0 ? "text-emerald-500" : trend.value < 0 ? "text-rose-500" : "text-muted-foreground")}>
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
