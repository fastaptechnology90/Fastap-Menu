import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/shared/Icon";
import { useAuth } from "@/contexts/AuthContext";
import { filterAdminNav, type PermissionKey } from "@/lib/adminRbac";

export function AdminNavContent({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const { user } = useAuth();
  const navGroups = filterAdminNav(
    user?.role ?? "super_admin",
    user?.permissions as PermissionKey[] | undefined,
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 pr-0.5 custom-scrollbar">
      {navGroups.map((group) => (
        <div key={group.title} className="mb-6 px-2">
          {!collapsed && (
            <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {group.title}
            </h3>
          )}
          {collapsed && (
            <div className="mb-2 flex justify-center">
              <div className="h-px w-8 bg-sidebar-border" />
            </div>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-primary/10 text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      collapsed ? "justify-center px-0" : "",
                    )}
                    title={collapsed ? item.title : undefined}
                  >
                    <Icon name={item.icon} size={20} className="shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
