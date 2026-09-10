import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { notificationsApi } from "@/lib/api";
import { Icon } from "@/components/shared/Icon";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { restaurantNavGroups, ROLE_ICONS } from "@/config/restaurantNav";
import { ROLE_PATH_ALLOWLIST } from "@/lib/restaurantRbac";

type HeaderNotification = { icon: string; msg: string; time: string; color: string };

function formatNotifTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "—";
  const diffMs = Date.now() - at.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return at.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function logTypeStyle(type: string | null | undefined) {
  const t = String(type || "").toLowerCase();
  if (t.includes("order") || t.includes("kitchen")) return { icon: "fiber_new", color: "text-warning" };
  if (t.includes("stock") || t.includes("alert") || t.includes("warning")) return { icon: "warning", color: "text-warning" };
  if (t.includes("ready") || t.includes("success")) return { icon: "check_circle", color: "text-success" };
  if (t.includes("reservation") || t.includes("event")) return { icon: "event", color: "text-info" };
  return { icon: "notifications", color: "text-muted-foreground" };
}

export function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const { restaurant, currentStaff, logoutStaff, liveOrders, canAccess, restaurantId } = useRestaurant();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [logNotifications, setLogNotifications] = useState<HeaderNotification[]>([]);

  useEffect(() => {
    if (!restaurantId) {
      setLogNotifications([]);
      return;
    }
    let cancelled = false;
    async function loadLogs() {
      try {
        const rows = await notificationsApi.list(restaurantId!);
        if (cancelled || !Array.isArray(rows)) return;
        setLogNotifications(rows.slice(0, 8).map(row => {
          const style = logTypeStyle(row.type);
          return {
            icon: style.icon,
            color: style.color,
            msg: row.message || row.title || "Notification",
            time: formatNotifTime(row.createdAt),
          };
        }));
      } catch {
        if (!cancelled) setLogNotifications([]);
      }
    }
    loadLogs();
    const timer = window.setInterval(loadLogs, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [restaurantId]);

  const allowedPaths = ROLE_PATH_ALLOWLIST[currentStaff?.role || "waiter"] || [];
  const newOrders = liveOrders.filter(o => o.status === "new").length;
  const roleIcon = ROLE_ICONS[currentStaff?.role || "waiter"] || "person";

  async function handleLogout() {
    await logoutStaff();
    navigate("/restaurant/login");
  }

  const headerNotifications = useMemo(() => {
    const live: HeaderNotification[] = [
      ...liveOrders.filter(o => o.status === "new").slice(0, 3).map(o => ({
        icon: "fiber_new",
        msg: `New order — Table ${o.tableNo} · ₹${o.total.toLocaleString()}`,
        time: "Just now",
        color: "text-warning",
      })),
      ...liveOrders.filter(o => o.status === "ready").slice(0, 2).map(o => ({
        icon: "check_circle",
        msg: `Order ready — Table ${o.tableNo}`,
        time: "Kitchen",
        color: "text-success",
      })),
    ];
    const seen = new Set<string>();
    return [...live, ...logNotifications].filter(n => {
      const key = `${n.msg}|${n.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  }, [liveOrders, logNotifications]);

  function toggleGroup(group: string) {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }

  /**
   * Service screens run edge to edge and do their own scrolling.
   *
   * The kitchen board, the till, the order list and the floor map are two-pane
   * layouts with pinned headers and a pinned primary action: they need the full
   * height of the viewport and they manage their own padding. Wrapping them in
   * the page's 16/24px gutter and a second scroll container is what put the
   * Collect button below the fold on a tablet.
   */
  const isKitchenDisplay = location.startsWith("/restaurant/kitchen");
  const FULL_BLEED = ["/restaurant/billing", "/restaurant/orders", "/restaurant/tables"];
  const isFullBleed = isKitchenDisplay || FULL_BLEED.some(p => location.startsWith(p));

  return (
    <div className="restaurant-panel flex h-screen overflow-hidden">
      {/* Off-canvas on phone; always in-flow from lg. The old 4.5rem icon rail
          permanently stole content width and made billing/KDS/tables overflow. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col restaurant-glass border-r transition-transform duration-300 ease-out overflow-hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:relative lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 px-3 py-4 border-b border-border shrink-0">
          <PanelLogo panel="restaurant" size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold truncate">{restaurant.name}</p>
            <p className="text-xs text-muted-foreground truncate">Manager Portal</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"
            aria-label="Close navigation"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="px-3 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-muted border border-border">
            <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <Icon name={roleIcon} size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{currentStaff?.name}</p>
              <p className="text-xs text-primary capitalize truncate">{currentStaff?.role}</p>
            </div>
            <div className="h-2 w-2 rounded-full bg-success shrink-0" />
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 px-2 pr-1 space-y-1 custom-scrollbar">
          {restaurantNavGroups.map(group => {
            const visibleItems = group.items.filter(item =>
              allowedPaths.includes(item.path) && canAccess(item.path),
            );
            if (visibleItems.length === 0) return null;
            const isCollapsed = collapsedGroups[group.group];
            return (
              <div key={group.group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.group)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg"
                >
                  <span className="flex-1 text-2xs font-semibold text-muted-foreground uppercase tracking-wider truncate text-left">{group.group}</span>
                  <Icon name={isCollapsed ? "chevron_right" : "expand_more"} size={16} className="text-muted-foreground shrink-0" />
                </button>
                {!isCollapsed && visibleItems.map(item => {
                  const isActive = location === item.path || location.startsWith(item.path + "/");
                  const badge = item.badge === "orders" && newOrders > 0 ? newOrders : null;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isActive ? "restaurant-nav-active" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon name={item.icon} size={20} className={`shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium truncate flex-1">{item.label}</span>
                      {badge != null && (
                        <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-warning text-background text-xs font-semibold flex items-center justify-center">{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-border shrink-0">
          <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-danger hover:bg-danger-subtle hover:text-danger transition-colors">
            <Icon name="logout" size={20} className="shrink-0" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-foreground/40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 restaurant-glass border-b shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          >
            <Icon name={sidebarOpen ? "close" : "menu"} size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="font-display text-sm font-semibold truncate capitalize">
              {restaurantNavGroups.flatMap(g => g.items).find(n => location.startsWith(n.path))?.label || "Dashboard"}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-success bg-success-subtle px-3 py-1.5 rounded-full">
              <Icon name="wifi" size={14} />
              <span>Live</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs bg-muted px-3 py-1.5 rounded-full text-muted-foreground">
              <Icon name="schedule" size={14} />
              <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="relative">
              <button type="button" onClick={() => setNotifOpen(!notifOpen)} className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center relative hover-elevate" aria-label="Notifications">
                <Icon name="notifications" size={18} />
                {(newOrders > 0 || headerNotifications.length > 0) && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-warning text-background text-2xs font-semibold flex items-center justify-center">
                    {newOrders > 0 ? newOrders : headerNotifications.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-[min(18rem,calc(100vw-1.5rem))] restaurant-card shadow-xl z-50 p-0 overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <p className="font-display text-sm font-semibold">Notifications</p>
                  </div>
                  <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                    {headerNotifications.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No notifications yet</p>
                    ) : headerNotifications.map((n, i) => (
                      <div key={i} className="flex gap-2.5 p-2.5 rounded-lg hover:bg-muted">
                        <Icon name={n.icon} size={20} className={n.color} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium break-words ${n.color}`}>{n.msg}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`flex-1 min-h-0 min-w-0 ${isFullBleed ? "overflow-hidden p-0" : "overflow-y-auto overflow-x-hidden p-4 lg:p-6"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
