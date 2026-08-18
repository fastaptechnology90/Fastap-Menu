import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AdminNavContent } from "./AdminNavContent";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="admin-panel flex min-h-screen w-full flex-col md:flex-row">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex flex-col w-[min(100vw-2rem,18rem)] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border overflow-hidden">
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle className="flex items-center justify-between">
              <PanelLogo panel="admin" showLabel label="Fastap OS" />
            </SheetTitle>
          </SheetHeader>
          <AdminNavContent onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col min-w-0">
        <Header
          onMenuClick={() => {
            if (window.matchMedia("(max-width: 767px)").matches) {
              setMobileNavOpen(true);
            } else {
              setSidebarCollapsed(!sidebarCollapsed);
            }
          }}
        />
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
