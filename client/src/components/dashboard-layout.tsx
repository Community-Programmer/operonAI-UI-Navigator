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
      <Sidebar className="border-r-0 bg-slate-950 text-slate-100">
        {/* ── Brand ── */}
        <SidebarHeader className="px-5 py-4">
          <button
            onClick={() => navigate("/app/systems")}
            className="flex items-center focus:outline-none"
          >
            <img src="/logo.png" alt="Logo" className="h-8 w-30 rounded-lg object-contain" />
          </button>
        </SidebarHeader>

        <Separator className="bg-slate-800/60" />

        {/* ── Navigation ── */}
        <SidebarContent className="px-3 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
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
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                        isActive={active}
                        onClick={() => navigate(item.path)}
                      >
                        <item.icon className={`h-4 w-4 ${active ? "text-blue-400" : ""}`} />
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
              <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
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
                              ? "bg-white/10 text-white shadow-sm"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          }`}
                          isActive={active}
                          onClick={() => navigate(item.path)}
                        >
                          <item.icon className={`h-4 w-4 ${active ? "text-blue-400" : ""}`} />
                          <span>{item.label}</span>
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
        <SidebarFooter className="border-t border-slate-800/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-[11px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-200">{username ?? userId?.slice(0, 12)}</p>
              <p className="text-[10px] text-slate-500">Online</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-slate-500 hover:bg-white/10 hover:text-rose-400"
              onClick={() => { logout(); navigate("/login"); }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col">
        {/* ── Top bar ── */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-5">
          <SidebarTrigger className="-ml-1 text-slate-400 hover:text-slate-900" />
          <Separator orientation="vertical" className="h-5 bg-slate-200" />
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <span>Dashboard</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-slate-900">{pageName(location.pathname)}</span>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 overflow-auto bg-white p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
