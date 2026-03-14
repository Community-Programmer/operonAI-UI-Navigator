import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { Activity, Monitor, LogOut, Navigation, ScrollText } from "lucide-react";

export function DashboardLayout() {
  const { isLoggedIn, logout, userId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <Sidebar className="bg-slate-950 text-slate-100">
        <SidebarHeader className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-slate-100">UI Navigator</span>
          </div>
        </SidebarHeader>
        <Separator className="bg-slate-800" />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-400">Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="text-slate-300 hover:bg-slate-800 hover:text-slate-100 data-[active=true]:bg-slate-200 data-[active=true]:text-slate-950"
                    isActive={location.pathname === "/app/systems"}
                    onClick={() => navigate("/app/systems")}
                  >
                    <Activity className="h-4 w-4" />
                    <span>Active Systems</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="text-slate-300 hover:bg-slate-800 hover:text-slate-100 data-[active=true]:bg-slate-200 data-[active=true]:text-slate-950"
                    isActive={location.pathname === "/app/devices"}
                    onClick={() => navigate("/app/devices")}
                  >
                    <Monitor className="h-4 w-4" />
                    <span>Devices</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="text-slate-300 hover:bg-slate-800 hover:text-slate-100 data-[active=true]:bg-slate-200 data-[active=true]:text-slate-950"
                    isActive={location.pathname.startsWith("/app/sessions")}
                    onClick={() => navigate("/app/sessions")}
                  >
                    <ScrollText className="h-4 w-4" />
                    <span>Session Logs</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="truncate text-xs text-slate-400">
              {userId?.slice(0, 8)}
            </span>
            <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-slate-800 hover:text-slate-100" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-slate-700">Operations Dashboard</span>
          </div>
          <span className="text-xs text-slate-500">User: {userId?.slice(0, 8)}</span>
        </header>
        <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,_#ecf6fb_0%,_#f6f8fb_40%,_#f8fafc_100%)] p-5">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
