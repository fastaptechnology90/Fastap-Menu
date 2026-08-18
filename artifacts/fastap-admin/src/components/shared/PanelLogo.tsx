import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

type Panel = "admin" | "restaurant" | "guest";

const panelStyles: Record<Panel, string> = {
  admin: "bg-primary shadow-primary/30",
  restaurant: "bg-amber-500 shadow-amber-500/30",
  guest: "guest-btn-primary shadow-orange-500/30",
};

export function PanelLogo({
  panel,
  size = "md",
  showLabel,
  label,
}: {
  panel: Panel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}) {
  const sizes = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-12 w-12" };
  const iconSizes = { sm: 18, md: 20, lg: 26 };

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={cn(
          "shrink-0 flex items-center justify-center rounded-xl shadow-lg text-white",
          sizes[size],
          panelStyles[panel],
        )}
      >
        <Icon name="bolt" size={iconSizes[size]} filled />
      </div>
      {showLabel && (
        <div className="min-w-0">
          <p className="font-display font-bold text-sm truncate">{label ?? "FastMenu"}</p>
          <p className="text-[10px] text-muted-foreground truncate capitalize">{panel} panel</p>
        </div>
      )}
    </div>
  );
}
