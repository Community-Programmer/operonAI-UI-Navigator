import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Clock3,
  Monitor,
  MonitorSmartphone,
  RefreshCw,
  Signal,
  Wifi,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import type { DeviceInfo } from "@/types";

function formatDate(value: string) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleString();
}

function timeAgo(value: string) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  const diffMs = Date.now() - dt.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isExpired(expiresAt: string) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export function SystemsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [systems, setSystems] = useState<DeviceInfo[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ time: string; online: number }[]>([]);

  const fetchSystems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.getActiveSystems(token);
      setSystems(res.systems);
      setOnlineCount(res.online_count);
      setHistory((prev) => {
        const next = [
          ...prev,
          { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), online: res.online_count },
        ];
        return next.slice(-20);
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSystems();
    const id = window.setInterval(fetchSystems, 5000);
    return () => window.clearInterval(id);
  }, [fetchSystems]);

  // Chart data
  const resolutionData = systems.reduce<Record<string, number>>((acc, s) => {
    const key = s.screen_width > 0 ? `${s.screen_width}×${s.screen_height}` : "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const resolutionChartData = Object.entries(resolutionData).map(([name, value]) => ({ name, value }));

  const pieColors = ["#9B3C3C", "#5C3D2E", "#C9A48C", "#6B5046", "#D4B8A0", "#E8DDD4"];

  const expiredCount = systems.filter((s) => isExpired(s.session_expires_at)).length;
  const activeCount = systems.length - expiredCount;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2D2018]">Active Systems</h1>
          <p className="mt-1 text-sm text-[#6B5046]">Real-time overview of connected desktops</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSystems}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#8A7060]">Online</p>
                <p className="mt-1 text-3xl font-bold text-[#2D2018]">{onlineCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <Wifi className="h-5 w-5 text-[#9B3C3C]" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FAF5F0] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FAF5F0]" />
              </span>
              <span className="text-xs text-[#9B3C3C] font-medium">Live monitoring</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#8A7060]">Total Tracked</p>
                <p className="mt-1 text-3xl font-bold text-[#2D2018]">{systems.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <MonitorSmartphone className="h-5 w-5 text-[#9B3C3C]" />
              </div>
            </div>
            <p className="mt-3 text-xs text-[#8A7060]">Registered systems</p>
          </CardContent>
        </Card>

        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#8A7060]">Active Sessions</p>
                <p className="mt-1 text-3xl font-bold text-[#2D2018]">{activeCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <Zap className="h-5 w-5 text-[#B07060]" />
              </div>
            </div>
            <p className="mt-3 text-xs text-[#8A7060]">Non-expired sessions</p>
          </CardContent>
        </Card>

        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#8A7060]">Expired</p>
                <p className="mt-1 text-3xl font-bold text-[#2D2018]">{expiredCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <Clock3 className="h-5 w-5 text-[#6B5046]" />
              </div>
            </div>
            <p className="mt-3 text-xs text-[#8A7060]">Need renewal</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Online History Chart */}
        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#2D2018]">Online Systems History</CardTitle>
            <CardDescription className="text-xs text-[#8A7060]">Live connection count over time</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9B3C3C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#9B3C3C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#8A7060" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#8A7060" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8DDD4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="online"
                    stroke="#9B3C3C"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#onlineGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-[#8A7060]">
                <Signal className="mr-2 h-4 w-4" />
                Collecting data...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolution Distribution */}
        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#2D2018]">Screen Resolutions</CardTitle>
            <CardDescription className="text-xs text-[#8A7060]">Distribution across online systems</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {resolutionChartData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={resolutionChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {resolutionChartData.map((_, i) => (
                        <Cell key={i} fill={pieColors[i % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8DDD4" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {resolutionChartData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: pieColors[i % pieColors.length] }}
                      />
                      <span className="text-xs text-[#6B5046]">{item.name}</span>
                      <span className="ml-auto text-xs font-semibold text-[#2D2018]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-[#8A7060]">
                <Monitor className="mr-2 h-4 w-4" />
                No systems online
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Systems Grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8A7060]">
          Connected Devices ({systems.length})
        </h2>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {systems.length === 0 && (
            <Card className="border-[#E8DDD4] bg-white shadow-sm lg:col-span-2 xl:col-span-3">
              <CardContent className="flex flex-col items-center justify-center py-16 text-[#8A7060]">
                <Activity className="mb-3 h-12 w-12 text-[#D4B8A0]" />
                <p className="text-sm font-medium">No active systems right now</p>
                <p className="mt-1 text-xs">Devices will appear here once they connect</p>
              </CardContent>
            </Card>
          )}

          {systems.map((system) => {
            const expired = isExpired(system.session_expires_at);
            return (
              <Card
                key={system.device_id}
                className={`group cursor-pointer border bg-white shadow-sm transition-all hover:shadow-md ${
                  expired ? "border-[#D4B8A0] hover:border-[#D4B8A0]" : "border-[#E8DDD4] hover:border-[#C9A48C]"
                }`}
                onClick={() => navigate(`/app/navigate/${system.device_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        expired ? "bg-[#FAF5F0]" : "bg-[#FAF5F0]"
                      }`}>
                        <Monitor className={`h-5 w-5 ${expired ? "text-[#6B5046]" : "text-[#9B3C3C]"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#2D2018] group-hover:text-[#9B3C3C] transition-colors">
                          {system.device_name}
                        </p>
                        <p className="text-[11px] font-mono text-[#8A7060]">{system.device_id}</p>
                      </div>
                    </div>
                    <Badge className={expired
                      ? "bg-[#FAF5F0] text-[#6B5046] border-[#D4B8A0]"
                      : "bg-[#FAF5F0] text-[#9B3C3C] border-[#C9A48C]"
                    }>
                      {expired ? "Expired" : "Online"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-[#FAF5F0] px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[#8A7060]">Resolution</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#2D2018]">
                        {system.screen_width > 0 ? `${system.screen_width}×${system.screen_height}` : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#FAF5F0] px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[#8A7060]">Last Seen</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#2D2018]">{timeAgo(system.last_seen_at)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#8A7060]">
                    <Clock3 className="h-3 w-3" />
                    <span>Expires {formatDate(system.session_expires_at)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
