import { cn } from "@/lib/utils";
import { Icon } from "@/components/shared/Icon";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { Button } from "@/components/ui/button";
import { AdminNavContent } from "./AdminNavContent";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        "admin-panel hidden md:flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 z-40 shrink-0 h-screen sticky top-0 overflow-hidden",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-3 gap-2">
        {!collapsed ? (
          <PanelLogo panel="admin" showLabel label="Fastap OS" />
        ) : (
          <PanelLogo panel="admin" size="sm" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name={collapsed ? "chevron_right" : "chevron_left"} size={20} />
        </Button>
      </div>
      <AdminNavContent collapsed={collapsed} />
    </aside>
  );
}
