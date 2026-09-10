/**
 * The guest app shell.
 *
 * Everything a diner sees after scanning the code at their table hangs off these pieces:
 * a bottom tab bar, a compact sticky app bar, a bottom sheet, a floating cart bar and a
 * page frame. They exist so the seven guest screens stop each inventing their own
 * chrome — which is what made the product read as a website at a phone width rather
 * than an app.
 *
 * Rules this file keeps:
 *  - tokens only, no hardcoded colour, no gradient, no emoji (lucide-react for icons)
 *  - every class is a literal, never interpolated — Tailwind cannot emit `bg-${x}-400`
 *  - the bottom edge always clears `env(safe-area-inset-bottom)`; the top edge clears
 *    `env(safe-area-inset-top)`
 *  - touch targets are at least 44px
 */
import {
  useCallback, useEffect, useId, useRef, useState,
  type ReactNode, type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { slugFromUrl, resolveGuestSlug, withGuestQuery } from "@/lib/guestDemo";
import { useGuestBack } from "@/hooks/useGuestBack";
import {
  ArrowLeft, ChevronRight, Home, UtensilsCrossed, ShoppingBag, CalendarDays, ShoppingCart, X,
} from "lucide-react";

/* ── measurements ──────────────────────────────────────────────────────────
   The tab bar is 3.5rem of controls above the home indicator. Anything fixed
   above it, and every scroll container beneath it, is spaced off these literals
   so a phone with a home indicator never eats the last row. */
export const TAB_BAR_CLEARANCE = "pb-[calc(4.25rem+env(safe-area-inset-bottom))]";
export const TAB_BAR_AND_CART_CLEARANCE = "pb-[calc(8.5rem+env(safe-area-inset-bottom))]";
const ABOVE_TAB_BAR = "bottom-[calc(3.5rem+env(safe-area-inset-bottom))]";

/** Where the guest home is: the venue they scanned into, or the menu if we have no venue. */
export function guestHomePath(venue?: { restaurantSlug?: string }, activeTable?: string): string {
  // The slug in the address bar wins, demo alias included. Resolving the saved scan
  // first meant that on a demo page (?slug=demo) whose venue had not finished loading,
  // the Home tab sent the diner to whatever real venue this browser had scanned before —
  // the same crossover the menu loaders were already fixed against.
  const slug = slugFromUrl() ?? resolveGuestSlug(venue?.restaurantSlug || undefined);
  if (!slug) return withGuestQuery("/user/menu", venue, activeTable);
  const current = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const qs = new URLSearchParams();
  const table = current.get("table") || activeTable;
  if (table) qs.set("table", table);
  const room = current.get("room");
  if (room) qs.set("room", room);
  const q = qs.toString();
  return q ? `/scan/${slug}?${q}` : `/scan/${slug}`;
}

/* ── bottom tab bar ────────────────────────────────────────────────────── */

/**
 * Four destinations, named by the owner: Home, Menu, Cart, Bookings.
 *
 * The bar it replaces offered Menu / Cart / Support / Profile and then hid itself on
 * the menu and the cart — the two screens it pointed at — so in practice a diner never
 * saw a tab bar at all.
 */
const TABS = [
  { key: "home", label: "Home", Icon: Home },
  { key: "menu", label: "Menu", Icon: UtensilsCrossed },
  { key: "cart", label: "Cart", Icon: ShoppingBag },
  { key: "bookings", label: "Bookings", Icon: CalendarDays },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Screens that own the whole viewport: sign-in, the kiosk, and the payment flow. */
const NO_TAB_BAR = [
  "/user/auth", "/user/kiosk", "/user/payment",
  "/user/pwa", "/user/offline", "/user/language", "/user/ai",
];

function activeTab(path: string): TabKey | null {
  if (path.startsWith("/scan/") || path.startsWith("/e/")) return "home";
  if (path.startsWith("/user/menu")) return "menu";
  if (path.startsWith("/user/cart")) return "cart";
  if (path.startsWith("/user/reserve") || path.startsWith("/user/queue")) return "bookings";
  return null;
}

export function GuestTabBar() {
  const [location, navigate] = useAppLocation();
  const { cartCount, venue, activeTable } = useUser();

  // Guard the guest area only. "/user" also prefixes the admin "/users" page, which is
  // how this bar used to appear on a super-admin screen.
  const inGuestArea =
    location === "/user" || location.startsWith("/user/") || location.startsWith("/scan/");
  if (!inGuestArea || NO_TAB_BAR.some(p => location.startsWith(p))) return null;

  const current = activeTab(location);
  const destination = (key: TabKey) => {
    if (key === "home") return guestHomePath(venue, activeTable);
    if (key === "menu") return withGuestQuery("/user/menu", venue, activeTable);
    if (key === "cart") return withGuestQuery("/user/cart", venue, activeTable);
    return withGuestQuery("/user/reserve?tab=my", venue, activeTable);
  };

  return (
    <nav
      aria-label="Guest navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-guest-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch">
        {TABS.map(({ key, label, Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(destination(key))}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
            >
              <span className="relative">
                <Icon
                  className={active ? "h-[21px] w-[21px] text-primary" : "h-[21px] w-[21px] text-muted-foreground"}
                  strokeWidth={active ? 2.4 : 1.9}
                />
                {key === "cart" && cartCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </span>
              <span className={active ? "text-[10px] font-semibold text-primary" : "text-[10px] font-medium text-muted-foreground"}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ── app bar ───────────────────────────────────────────────────────────── */

/**
 * The compact sticky header. Venue name, the table the guest is sitting at, and a back
 * affordance where one makes sense — nothing else.
 *
 * The header it replaces stacked a 56px badge, an eyebrow, a display heading and a
 * subtitle inside a translucent bar; on a phone in daylight the whole thing was hard to
 * read and half the first screen was gone before any content began.
 */
export function GuestAppBar({
  title,
  subtitle,
  onBack,
  backFallback,
  showBack = true,
  right,
  below,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  backFallback?: string;
  showBack?: boolean;
  right?: ReactNode;
  below?: ReactNode;
}) {
  const goBack = useGuestBack(backFallback);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-guest-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack ?? goBack}
            aria-label="Go back"
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[15px] font-semibold leading-tight">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      {below}
    </header>
  );
}

/** A small square control for the app bar's right slot. */
export function GuestAppBarButton({
  label,
  onClick,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors hover:bg-accent"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

/** The table the guest is sitting at, as one small pill. */
export function GuestTableChip({ table, room }: { table?: string; room?: string | null }) {
  const label = room ? `Room ${room}` : table ? `Table ${table}` : null;
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded-pill border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
      {label}
    </span>
  );
}

/* ── page frame ────────────────────────────────────────────────────────── */

/**
 * A guest screen: the panel ground, a body that clears the tab bar, and an entrance
 * that reads as a push rather than a page load.
 */
export function GuestAppScreen({
  children,
  className = "",
  withCartBar = false,
}: {
  children: ReactNode;
  className?: string;
  withCartBar?: boolean;
}) {
  const clearance = withCartBar ? TAB_BAR_AND_CART_CLEARANCE : TAB_BAR_CLEARANCE;
  return (
    <div
      className={`guest-page thin-scroll min-h-dvh text-foreground animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ${clearance} ${className}`}
    >
      {children}
    </div>
  );
}

/** The body of a guest screen — one column, phone width, consistent gutters. */
export function GuestBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-lg px-4 py-4 ${className}`}>{children}</main>;
}

/** A titled block inside a screen. */
export function GuestSection({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-5 first:mt-0 ${className}`}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A tappable row — the list idiom the guest screens use instead of a grid of cards. */
export function GuestRow({
  icon,
  title,
  detail,
  trailing,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  detail?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{title}</span>
        {detail && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{detail}</span>}
      </span>
      {trailing ?? (onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null)}
    </>
  );
  if (!onClick) {
    return <div className="flex min-h-14 w-full items-center gap-3 px-4 py-3">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent active:bg-accent"
    >
      {inner}
    </button>
  );
}

/** A grouped list — rows hairlined together, the way a phone settings list reads. */
export function GuestList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`divide-y divide-border overflow-hidden rounded-md border border-border bg-card ${className}`}>
      {children}
    </div>
  );
}

/* ── segmented control ─────────────────────────────────────────────────── */

export function GuestSegmented<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 rounded-md border border-border bg-muted p-1 ${className}`} role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={
            value === o.value
              ? "min-h-10 flex-1 rounded-sm bg-card text-xs font-semibold text-foreground shadow-xs transition-colors"
              : "min-h-10 flex-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── bottom sheet ──────────────────────────────────────────────────────── */

/**
 * The one overlay idiom in the guest app: a sheet that rises from the bottom edge, with
 * a drag handle you can actually drag. Dish options, filters and confirmations all use
 * it. A centre dialog on a phone puts its controls in the middle of the screen, out of
 * thumb reach, and its close button in the corner furthest from the thumb.
 */
export function GuestSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "auto",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "auto" | "tall" | "full";
}) {
  const titleId = useId();
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const dismiss = useCallback(() => { setDrag(0); onClose(); }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setDrag(0);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, dismiss]);

  if (!open || typeof document === "undefined") return null;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (startY.current === null) return;
    setDrag(Math.max(0, e.clientY - startY.current));
  }
  function onPointerUp() {
    if (startY.current !== null && drag > 90) dismiss();
    else setDrag(0);
    startY.current = null;
  }

  const heightClass =
    size === "full" ? "h-[92dvh]" : size === "tall" ? "max-h-[88dvh]" : "max-h-[85dvh]";

  return createPortal(
    <div
      className="guest-page fixed inset-0 z-[60] flex items-end justify-center bg-black/60 animate-in fade-in-0 duration-150"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={e => e.stopPropagation()}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={`flex w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-b-0 border-border bg-guest-elevated text-foreground shadow-xl animate-in slide-in-from-bottom duration-200 ${heightClass}`}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 cursor-grab touch-none pt-2.5 active:cursor-grabbing"
        >
          <span className="mx-auto block h-1 w-10 rounded-pill bg-border" />
        </div>

        {(title || description) && (
          <div className="flex shrink-0 items-start gap-3 px-4 pb-3 pt-3">
            <div className="min-w-0 flex-1">
              {title && <h2 id={titleId} className="truncate font-display text-base font-semibold">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-border bg-guest-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── floating cart bar ─────────────────────────────────────────────────── */

/**
 * Appears the moment the basket has something in it, sits directly above the tab bar,
 * and says what is in the basket and what it comes to. One tap into the cart.
 */
export function GuestCartBar({
  count,
  total,
  label = "View cart",
  onClick,
  disabled = false,
  disabledLabel,
}: {
  count: number;
  total: number;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  if (count <= 0) return null;
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-40 px-3 pb-2 ${ABOVE_TAB_BAR}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="pointer-events-auto mx-auto flex h-12 w-full max-w-lg items-center justify-between gap-3 rounded-md bg-primary px-4 text-primary-foreground shadow-lg transition-opacity disabled:opacity-60"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="h-4 w-4" />
          {count} {count === 1 ? "item" : "items"}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
          {disabled && disabledLabel ? disabledLabel : `₹${total} · ${label}`}
          {!disabled && <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
    </div>
  );
}

/* ── sticky action bar ─────────────────────────────────────────────────── */

/** The one primary action of a screen, parked in the thumb zone above the tab bar. */
export function GuestActionBar({ children }: { children: ReactNode }) {
  return (
    <div className={`fixed inset-x-0 z-40 border-t border-border bg-guest-surface px-4 py-3 ${ABOVE_TAB_BAR}`}>
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}

/** The full-width primary button the guest screens use in an action bar or a sheet footer. */
export function GuestPrimaryButton({
  children,
  onClick,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
