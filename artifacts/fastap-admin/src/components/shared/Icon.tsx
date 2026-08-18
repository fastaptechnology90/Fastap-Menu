import { cn } from "@/lib/utils";

export type MaterialIconName = string;

type IconProps = {
  name: MaterialIconName;
  className?: string;
  filled?: boolean;
  size?: number;
  title?: string;
};

/** Google Material Symbols — use ligature names e.g. "dashboard", "restaurant_menu" */
export function Icon({ name, className, filled = false, size = 20, title }: IconProps) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={!title}
      className={cn(
        filled ? "material-symbols-rounded" : "material-symbols-outlined",
        "leading-none select-none",
        className,
      )}
      style={{ fontSize: size, width: size, height: size }}
    >
      {name}
    </span>
  );
}
