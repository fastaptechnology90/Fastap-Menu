import type { ReactNode } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useGuestBack } from "@/hooks/useGuestBack";
import { useUser } from "@/contexts/UserContext";
import { withGuestQuery } from "@/lib/guestDemo";
import { Icon } from "@/components/shared/Icon";
import { UtensilsCrossed, ShoppingCart, Headphones, User, ArrowLeft } from "lucide-react";

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
      className={`h-9 w-9 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all ${className}`}
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
    <div className={`guest-page thin-scroll min-h-screen text-white ${withNav ? "pb-24" : ""} ${className}`}>
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
            {subtitle && <p className="text-[11px] text-white/40 truncate">{subtitle}</p>}
            {title && <h1 className="font-display font-bold text-base truncate">{title}</h1>}
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

const NAV_ITEMS = [
  { path: "/user/menu", label: "Menu", Icon: UtensilsCrossed, match: (p: string) => p.startsWith("/user/menu") },
  { path: "/user/cart", label: "Cart", Icon: ShoppingCart, match: (p: string) => p === "/user/cart" },
  { path: "/user/support", label: "Support", Icon: Headphones, match: (p: string) => p.startsWith("/user/support") },
  { path: "/user/profile", label: "Profile", Icon: User, match: (p: string) => p.startsWith("/user/profile") },
];

const HIDE_NAV_PATHS = [
  "/user/auth", "/user/kiosk", "/user/menu", "/user/cart",
  "/user/payment", "/user/pwa", "/user/offline", "/user/language", "/user/ai",
];

export function GuestBottomNav() {
  const [location, navigate] = useAppLocation();
  const { cartCount, venue, activeTable } = useUser();

  if (
    !location.startsWith("/user")
    || HIDE_NAV_PATHS.some(p => location.startsWith(p))
    || location.startsWith("/user/order/")
  ) {
    return null;
  }

  return (
    <nav className="guest-bottom-nav" aria-label="Guest navigation">
      <div className="guest-bottom-nav-inner">
        {NAV_ITEMS.map(item => {
          const active = item.match(location);
          const NavIcon = item.Icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(withGuestQuery(item.path, venue, activeTable))}
              className={`guest-nav-item relative ${active ? "guest-nav-item-active" : ""}`}
            >
              <NavIcon className={`h-[22px] w-[22px] ${active ? "text-orange-400" : ""}`} strokeWidth={active ? 2.25 : 2} />
              {item.label === "Cart" && cartCount > 0 && (
                <span className="absolute -top-0.5 right-1 h-4 min-w-4 px-1 rounded-full bg-orange-500 text-[9px] font-bold flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function GuestLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-11 w-11" };
  const iconSizes = { sm: 18, md: 20, lg: 26 };
  return (
    <div className={`${sizes[size]} rounded-xl guest-btn-primary flex items-center justify-center shadow-lg`}>
      <Icon name="bolt" size={iconSizes[size]} filled />
    </div>
  );
}
