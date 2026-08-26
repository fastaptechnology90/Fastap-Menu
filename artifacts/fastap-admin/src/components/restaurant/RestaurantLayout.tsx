import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { notificationsApi } from "@/lib/api";
import { Icon } from "@/components/shared/Icon";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { restaurantNavGroups, RESTAURANT_ALL_PATHS, ROLE_ICONS } from "@/config/restaurantNav";

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: RESTAURANT_ALL_PATHS,
  manager: RESTAURANT_ALL_PATHS.filter(
    p => !["/restaurant/audit", "/restaurant/branches", "/restaurant/rbac", "/restaurant/backup", "/restaurant/white-label", "/restaurant/sandbox", "/restaurant/api-platform"].includes(p),
  ),
  cashier: ["/restaurant/dashboard", "/restaurant/orders", "/restaurant/billing", "/restaurant/cash-counter", "/restaurant/notifications"],
  waiter: ["/restaurant/dashboard", "/restaurant/orders", "/restaurant/tables", "/restaurant/queue", "/restaurant/waiter"],
  kitchen: ["/restaurant/kitchen", "/restaurant/menu", "/restaurant/inventory"],
  chef: ["/restaurant/kitchen", "/restaurant/menu", "/restaurant/inventory", "/restaurant/food-costing", "/restaurant/procurement"],
  reception: ["/restaurant/reception", "/restaurant/dashboard", "/restaurant/reservations", "/restaurant/customers", "/restaurant/queue", "/restaurant/room-service", "/restaurant/events"],
  finance: ["/restaurant/analytics", "/restaurant/billing", "/restaurant/finance", "/restaurant/cash-counter", "/restaurant/corporate-billing"],
  hr: ["/restaurant/staff", "/restaurant/commissions", "/restaurant/tasks-sop"],
  bar: ["/restaurant/orders", "/restaurant/billing", "/restaurant/inventory", "/restaurant/bar"],
  spa: ["/restaurant/reservations", "/restaurant/customers", "/restaurant/spa"],
  housekeeping: ["/restaurant/housekeeping", "/restaurant/room-service", "/restaurant/tasks-sop"],
  franchise: RESTAURANT_ALL_PATHS,
};

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
  if (t.includes("order") || t.includes("kitchen")) return { icon: "fiber_new", color: "text-orange-400" };
  if (t.includes("stock") || t.includes("alert") || t.includes("warning")) return { icon: "warning", color: "text-yellow-400" };
  if (t.includes("ready") || t.includes("success")) return { icon: "check_circle", color: "text-emerald-400" };
  if (t.includes("reservation") || t.includes("event")) return { icon: "event", color: "text-blue-400" };
  return { icon: "notifications", color: "text-violet-400" };
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

  const allowedPaths = ROLE_PERMISSIONS[currentStaff?.role || "waiter"] || [];
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
        color: "text-orange-400",
      })),
      ...liveOrders.filter(o => o.status === "ready").slice(0, 2).map(o => ({
        icon: "check_circle",
        msg: `Order ready — Table ${o.tableNo}`,
        time: "Kitchen",
        color: "text-emerald-400",
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

  const sidebarWide = sidebarOpen;
  const isKitchenDisplay = location.startsWith("/restaurant/kitchen");

  return (
    <div className="restaurant-panel flex h-screen overflow-hidden">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col restaurant-glass border-r transition-all duration-300 overflow-hidden ${
          sidebarWide ? "w-64" : "w-[4.5rem]"
        } lg:relative lg:w-64`}
      >
        <div className="flex items-center gap-3 px-3 py-4 border-b border-white/5 shrink-0">
          <PanelLogo panel="restaurant" size="md" />
          <div className={`overflow-hidden transition-all min-w-0 ${sidebarWide ? "opacity-100" : "opacity-0 w-0 lg:opacity-100 lg:w-auto"}`}>
            <p className="font-display text-sm font-bold truncate">{restaurant.name}</p>
            <p className="text-xs text-white/40 truncate">Manager Portal</p>
          </div>
        </div>

        <div className={`px-3 py-3 border-b border-white/5 shrink-0 ${sidebarWide ? "block" : "hidden lg:block"}`}>
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white/5 border border-white/5">
            <div className="h-9 w-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Icon name={roleIcon} size={20} className="text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{currentStaff?.name}</p>
              <p className="text-xs text-amber-400 capitalize truncate">{currentStaff?.role}</p>
            </div>
            <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
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
                  onClick={() => toggleGroup(group.group)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${sidebarWide ? "opacity-100" : "opacity-0 lg:opacity-100"}`}
                >
                  <span className="flex-1 text-[10px] font-bold text-white/30 uppercase tracking-wider truncate text-left">{group.group}</span>
                  <Icon name={isCollapsed ? "chevron_right" : "expand_more"} size={16} className="text-white/25 shrink-0" />
                </button>
                {!isCollapsed && visibleItems.map(item => {
                  const isActive = location === item.path || location.startsWith(item.path + "/");
                  const badge = item.badge === "orders" && newOrders > 0 ? newOrders : null;
                  return (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        isActive ? "restaurant-nav-active" : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon name={item.icon} size={20} className={`shrink-0 ${isActive ? "text-amber-400" : "text-white/40"}`} />
                      <span className={`text-sm font-medium truncate flex-1 ${sidebarWide ? "opacity-100" : "opacity-0 lg:opacity-100"}`}>{item.label}</span>
                      {badge != null && (
                        <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-white/5 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all">
            <Icon name="logout" size={20} className="shrink-0" />
            <span className={`text-sm ${sidebarWide ? "opacity-100" : "opacity-0 lg:opacity-100"}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 restaurant-glass border-b shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Icon name={sidebarOpen ? "close" : "menu"} size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="font-display text-sm font-bold truncate capitalize">
              {restaurantNavGroups.flatMap(g => g.items).find(n => location.startsWith(n.path))?.label || "Dashboard"}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full">
              <Icon name="wifi" size={14} />
              <span>Live</span>
            </div>
            <div className="hidden xs:flex items-center gap-1 text-xs bg-white/5 px-3 py-1.5 rounded-full text-white/50">
              <Icon name="schedule" size={14} />
              <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center relative hover:bg-white/15">
                <Icon name="notifications" size={18} />
                {(newOrders > 0 || headerNotifications.length > 0) && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {newOrders > 0 ? newOrders : headerNotifications.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-72 restaurant-card shadow-2xl z-50 p-0 overflow-hidden">
                  <div className="p-4 border-b border-white/5">
                    <p className="font-display text-sm font-bold">Notifications</p>
                  </div>
                  <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                    {headerNotifications.length === 0 ? (
                      <p className="text-xs text-white/40 text-center py-6">No notifications yet</p>
                    ) : headerNotifications.map((n, i) => (
                      <div key={i} className="flex gap-2.5 p-2.5 rounded-xl hover:bg-white/5">
                        <Icon name={n.icon} size={20} className={n.color} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${n.color}`}>{n.msg}</p>
                          <p className="text-xs text-white/30 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`flex-1 min-h-0 ${isKitchenDisplay ? "overflow-hidden p-0" : "overflow-y-auto p-4 lg:p-6"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
