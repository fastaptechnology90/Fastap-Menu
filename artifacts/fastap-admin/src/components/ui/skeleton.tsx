import { cn } from "@/lib/utils"

/**
 * A placeholder is absent content, so it is drawn in the muted surface colour.
 * It used to be `bg-primary/10` — a page mid-load was a grid of faintly blue
 * blocks, which reads as a state rather than as nothing-yet.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
