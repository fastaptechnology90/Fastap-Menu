import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/**
 * Day / night switch for the operator panels.
 *
 * Shows the mode you would switch *to*, which is the convention every OS uses —
 * a sun means "go light", not "you are light". The label is on the button rather
 * than a tooltip so it is reachable by a screen reader and by a thumb.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to day mode" : "Switch to night mode"}
      aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
      aria-pressed={isDark}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className}`}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
