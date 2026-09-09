import type { ReactNode } from "react";
import { AlertCircle, Inbox, SearchX } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Defaults to the glyph for the chosen tone. */
  icon?: ReactNode;
  title: string;
  /** One line explaining why this is empty, or what to do about it. */
  description?: string;
  /** Usually the button that fills the list — "Add your first menu item". */
  action?: ReactNode;
  /**
   * What kind of nothing this is. `empty` means there is no data yet, `search`
   * means a filter excluded it, `error` means loading failed. Telling them apart
   * matters: "no orders" and "we could not load your orders" ask the user to do
   * completely different things, and this product currently shows the first when
   * it means the second.
   */
  tone?: "empty" | "search" | "error";
  className?: string;
}

const TONE = {
  empty: { icon: Inbox, className: "bg-muted text-muted-foreground" },
  search: { icon: SearchX, className: "bg-muted text-muted-foreground" },
  error: { icon: AlertCircle, className: "bg-danger-subtle text-danger" },
} as const;

/**
 * The nothing-here state. A blank panel reads as a bug; this reads as an answer.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "empty",
  className,
}: EmptyStateProps) {
  const { icon: FallbackIcon, className: iconClassName } = TONE[tone];

  return (
    <div
      className={cn("flex flex-col items-center justify-center px-4 py-12 text-center", className)}
      // An error state is a live region: it usually appears after the user has
      // already looked away from the spot it lands in.
      role={tone === "error" ? "alert" : undefined}
    >
      <div
        className={cn(
          "mb-3 flex h-11 w-11 items-center justify-center rounded-md",
          iconClassName
        )}
      >
        {icon ?? <FallbackIcon className="h-5 w-5" aria-hidden="true" />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
