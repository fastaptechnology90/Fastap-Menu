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

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

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
              className="pl-9 h-9 sm:h-10 w-full sm:w-[240px] lg:w-[300px] rounded-xl bg-muted/40 border-muted focus:bg-background"
            />
          </div>
        </form>

        <Button variant="ghost" size="icon" className="relative shrink-0 rounded-xl" onClick={() => navigate("/notifications")}>
          <Icon name="notifications" size={22} />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive admin-glow-dot" />
          <span className="sr-only">Notifications</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full shrink-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
              <span className="sr-only">User menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold">{user?.name ?? "Super Admin"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
                <p className="text-[10px] text-primary font-medium uppercase tracking-wide pt-1">{user?.role ?? "super_admin"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer rounded-lg">
              <Icon name="settings" size={18} className="mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive rounded-lg">
              <Icon name="logout" size={18} className="mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
