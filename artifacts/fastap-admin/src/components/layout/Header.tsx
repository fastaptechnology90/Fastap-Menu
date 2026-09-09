import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/apiClient";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("fastap-theme", next ? "dark" : "light"); } catch { /* ignore */ }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  // The bell used to carry a permanent dot whether or not anything was waiting.
  // `/superadmin/notifications` currently returns [], so it was an unread badge for an
  // empty inbox — the operator learns to ignore it, and then misses a real one.
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications.list,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const unread = notifications.filter((n: any) => {
    const read = n?.read ?? n?.isRead ?? n?.readAt;
    return read === false || read == null;
  }).length;

  const initials = (user?.name ?? "SA")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sm:px-6">
      <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onMenuClick}>
        <Icon name="menu" size={22} />
        <span className="sr-only">Open navigation</span>
      </Button>

      <div className="flex w-full items-center gap-3 sm:gap-4 md:ml-auto">
        <form
          className="ml-auto flex-1 sm:flex-initial max-w-md"
          onSubmit={e => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q") as string;
            if (q?.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
            else navigate("/search");
          }}
        >
          <div className="relative">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              type="search"
              placeholder="Master search — vendors, payments…"
              className="h-9 w-full pl-9 sm:h-10 sm:w-[240px] lg:w-[300px]"
            />
          </div>
        </form>

        <Button variant="ghost" size="icon" className="shrink-0" onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
          <Icon name={isDark ? "light_mode" : "dark_mode"} size={22} />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          onClick={() => navigate("/notifications")}
          title={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        >
          <Icon name="notifications" size={22} />
          {unread > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
          )}
          <span className="sr-only">{unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full shrink-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <span className="sr-only">User menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold">{user?.name ?? "Super Admin"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
                <p className="pt-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{user?.role ?? "super_admin"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Icon name="settings" size={18} className="mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <Icon name="logout" size={18} className="mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
