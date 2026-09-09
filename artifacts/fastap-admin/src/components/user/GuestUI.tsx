import type { ReactNode } from "react";
import { useGuestBack } from "@/hooks/useGuestBack";
import { Icon } from "@/components/shared/Icon";
import { ArrowLeft } from "lucide-react";

export function GuestBackButton({
  fallback,
  onClick,
  className = "",
}: {
  fallback?: string;
  onClick?: () => void;
  className?: string;
}) {
  const goBack = useGuestBack(fallback);
  return (
    <button
      type="button"
      onClick={onClick ?? goBack}
      aria-label="Go back"
      className={`h-9 w-9 shrink-0 rounded-xl bg-muted border border-border flex items-center justify-center hover:bg-muted active:scale-95 transition-all ${className}`}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}

export function GuestPage({
  children,
  className = "",
  withNav = false,
}: {
  children: ReactNode;
  className?: string;
  withNav?: boolean;
}) {
  return (
    <div className={`guest-page thin-scroll min-h-screen text-foreground ${withNav ? "pb-24" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function GuestHeader({
  title,
  subtitle,
  onBack,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="guest-header">
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && <GuestBackButton onClick={onBack} />}
          <div className="flex-1 min-w-0">
            {subtitle && <p className="text-2xs text-muted-foreground truncate">{subtitle}</p>}
            {title && <h1 className="font-display font-semibold text-base truncate">{title}</h1>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </header>
  );
}

/** Standard nested guest page — back button, header, scrollable body */
export function GuestScreen({
  title,
  subtitle,
  onBack,
  backFallback,
  actions,
  headerExtra,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backFallback?: string;
  actions?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const goBack = useGuestBack(backFallback);
  return (
    <GuestPage className={className}>
      <GuestHeader title={title} subtitle={subtitle} onBack={onBack ?? goBack} actions={actions}>
        {headerExtra}
      </GuestHeader>
      <main className="guest-screen-body">{children}</main>
    </GuestPage>
  );
}

export function GuestCard({
  children,
  className = "",
  interactive = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`guest-card p-4 ${interactive ? "guest-card-interactive cursor-pointer text-left w-full" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

/**
 * The app's bottom navigation.
 *
 * It used to offer Menu / Cart / Support / Profile and then hide itself on the menu and
 * the cart — the two screens it pointed at — so a diner effectively never saw a tab bar.
 * The four destinations are now Home / Menu / Cart / Bookings and it stays on screen
 * across the ordering journey. The implementation moved to `GuestShell`; this export is
 * kept so the single mount point in the router does not have to know.
 */
export { GuestTabBar as GuestBottomNav } from "@/components/user/GuestShell";

export function GuestLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-11 w-11" };
  const iconSizes = { sm: 18, md: 20, lg: 26 };
  return (
    <div className={`${sizes[size]} rounded-xl guest-btn-primary flex items-center justify-center shadow-lg`}>
      <Icon name="bolt" size={iconSizes[size]} filled />
    </div>
  );
}
