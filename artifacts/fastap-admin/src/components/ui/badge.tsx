import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * A badge states a status. It is not decoration, and a screen that shows six of
 * them in six hues has said nothing.
 *
 * The semantic variants below exist so pages stop reaching for
 * `bg-green-500/10 text-green-500 border-green-500/20` by hand — that pattern is
 * spelled a dozen slightly different ways across the product and none of them
 * follow the theme. Each semantic variant is a tinted fill, a matching border and
 * the readable text weight of that state, all from the same three tokens.
 */
const badgeVariants = cva(
  // Badges should never wrap.
  [
    "whitespace-nowrap inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
    "text-xs font-medium transition-colors",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "[&_svg]:size-3 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border [border-color:var(--badge-outline)]",
        success: "border-success-border bg-success-subtle text-success",
        warning: "border-warning-border bg-warning-subtle text-warning",
        danger: "border-danger-border bg-danger-subtle text-danger",
        info: "border-info-border bg-info-subtle text-info",
        /** For "no status yet" / "not applicable" — reads as absent, not as a state. */
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
