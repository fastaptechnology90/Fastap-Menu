import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Defaults to a neutral inbox glyph. */
  icon?: ReactNode;
  title: string;
  /** One line explaining why this is empty, or what to do about it. */
  description?: string;
  /** Usually the button that fills the list — "Add your first menu item". */
  action?: ReactNode;
  className?: string;
}

/**
 * The nothing-here state. A blank panel reads as a bug; this reads as an
 * answer.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-12 text-center", className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
