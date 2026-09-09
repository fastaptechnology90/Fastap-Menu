import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * `text-base` on small screens, `text-sm` from `md` up. This is not a style
 * choice: iOS Safari zooms the page when a focused input's font-size is under
 * 16px, and the guest menu is a phone surface.
 *
 * Height comes from the shared control height so an input, a select trigger and a
 * button in the same toolbar line up, and grows to 44px on touch devices — see the
 * `pointer: coarse` rule in index.css.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1",
          "text-base md:text-sm shadow-xs transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // A field the user cannot fix should not look like one they can.
          "aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
