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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  Activity,
  ChevronRight,
  Compass,
  LogOut,
  Mic,
  Monitor,
  ScrollText,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Active Systems", path: "/app/systems", icon: Activity, match: (p: string) => p === "/app/systems" },
  { label: "Devices", path: "/app/devices", icon: Monitor, match: (p: string) => p === "/app/devices" },
  { label: "Session Logs", path: "/app/sessions", icon: ScrollText, match: (p: string) => p.startsWith("/app/sessions") },
];

function extractDeviceId(pathname: string): string | null {
  const m = pathname.match(/^\/app\/(?:navigate|voice)\/(.+)$/);
  return m ? m[1] : null;
}

function pageName(pathname: string): string {
  if (pathname.startsWith("/app/navigate/")) return "Navigate";
  if (pathname.startsWith("/app/voice/")) return "Voice Control";
  if (pathname.startsWith("/app/sessions/") && pathname !== "/app/sessions") return "Session Detail";
  const item = NAV_ITEMS.find((n) => n.match(pathname));
  return item?.label ?? "Dashboard";
}

export function DashboardLayout() {
  const { isLoggedIn, logout, userId, username } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  const initials = username?.slice(0, 2).toUpperCase() ?? userId?.slice(0, 2).toUpperCase() ?? "U";
  const activeDeviceId = extractDeviceId(location.pathname);

  return (
    <SidebarProvider>
      <Sidebar className="border-r-0 bg-[#AE6160] text-white">
        {/* ── Brand ── */}
        <SidebarHeader className="px-5 py-4">
          <button
            onClick={() => navigate("/app/systems")}
            className="flex items-center focus:outline-none"
          >
            <img src="/logo.png" alt="Logo" className="h-8 w-30 rounded-lg object-contain" />
          </button>
        </SidebarHeader>

        <Separator className="bg-white/20" />

        {/* ── Navigation ── */}
        <SidebarContent className="px-3 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-white/60">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {NAV_ITEMS.map((item) => {
                  const active = item.match(location.pathname);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                          active
                            ? "bg-white/20 text-white shadow-sm"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                        isActive={active}
                        onClick={() => navigate(item.path)}
                      >
                        <item.icon className={`h-4 w-4 ${active ? "text-white" : ""}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Control group — visible when on navigate/voice pages */}
          {activeDeviceId && (
            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-white/60">
                Control
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {[
                    { label: "Navigate", path: `/app/navigate/${activeDeviceId}`, icon: Compass, match: (p: string) => p.startsWith("/app/navigate/") },
                    { label: "Voice", path: `/app/voice/${activeDeviceId}`, icon: Mic, match: (p: string) => p.startsWith("/app/voice/") },
                  ].map((item) => {
                    const active = item.match(location.pathname);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                            active
                              ? "bg-white/20 text-white shadow-sm"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                        isActive={active}
                        onClick={() => navigate(item.path)}
                      >
                        <item.icon className={`h-4 w-4 ${active ? "text-white" : ""}`} />
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* ── User footer ── */}
        <SidebarFooter className="border-t border-white/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-[#9B3C3C] text-[11px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{username ?? userId?.slice(0, 12)}</p>
              <p className="text-[10px] text-white/60">Online</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() => { logout(); navigate("/login"); }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col">
        {/* ── Top bar ── */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#E8DDD4] bg-white px-5">
          <SidebarTrigger className="-ml-1 text-[#8A7060] hover:text-[#2D2018]" />
          <Separator orientation="vertical" className="h-5 bg-[#E8DDD4]" />
          <div className="flex items-center gap-1.5 text-sm text-[#8A7060]">
            <span>Dashboard</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-[#2D2018]">{pageName(location.pathname)}</span>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 overflow-auto bg-[#FEFCFA] p-4 sm:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
