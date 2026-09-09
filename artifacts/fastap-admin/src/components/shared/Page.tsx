import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Page furniture: the header, the sections under it, and the toolbar that sits
 * above a list.
 *
 * Every screen in this product opens differently — some with an h1, some with an
 * h2 inside a coloured card, some with nothing at all — which is most of why the
 * three panels do not read as one product. These are the pieces that make a page
 * look like the page next to it without the page having to think about it.
 */

export interface PageHeaderProps {
  title: string;
  /** One line. What this screen is for, or what the number on it counts. */
  description?: string;
  /** A status chip or count that belongs with the title rather than under it. */
  badge?: ReactNode;
  /** Buttons. The rightmost is the primary action; there should be exactly one. */
  actions?: ReactNode;
  /** Breadcrumb or back link, rendered above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("border-b pb-4", className)}>
      {eyebrow && <div className="mb-2 text-xs text-muted-foreground">{eyebrow}</div>}
      {/* Actions drop below the title on a phone and sit beside it from `sm` up.
          They also stretch to full width down there, because a row of three
          half-width buttons is harder to hit than a stack of three wide ones. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export interface SectionProps {
  /** Omit for an unlabelled group — the spacing still applies. */
  title?: string;
  description?: string;
  /** Sits opposite the title: a filter, a "view all", a small toggle. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A labelled block within a page. Use this instead of a `<Card>` when the content
 * is part of the page rather than an object in its own right — a card inside a
 * card is the most common way a screen here ends up looking cluttered.
 */
export function Section({ title, description, action, children, className }: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export interface ToolbarProps {
  /** Search field, filters — anything that narrows what is below. */
  children?: ReactNode;
  /** Buttons that act on the list as a whole: export, bulk edit, add. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The filter row above a table or list. Wraps rather than scrolls, so a tablet in
 * portrait gets two short rows instead of a hidden filter.
 */
export function Toolbar({ children, actions, className }: ToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * The standard vertical rhythm of a page body. Sections are 24px apart; anything
 * closer starts to read as one block.
 */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
