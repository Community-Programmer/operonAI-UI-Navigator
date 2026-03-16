import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Copy,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Timer,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import type { DeviceInfo, PairDeviceRequest, TokenResponse } from "@/types";

function formatDate(value: string) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleString();
}

function isExpired(expiresAt: string) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function timeRemaining(expiresAt: string) {
  if (!expiresAt) return "-";
  const dt = new Date(expiresAt);
  if (Number.isNaN(dt.getTime())) return expiresAt;
  const diffMs = dt.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m left`;
  return `${Math.floor(hours / 24)}d left`;
}

type FilterTab = "all" | "online" | "offline" | "expired";

export function DevicesPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [newToken, setNewToken] = useState<TokenResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeviceInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pairing, setPairing] = useState<PairDeviceRequest>({
    device_name: "",
    session_minutes: 120,
  });

  const fetchDevices = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setDevices(await api.getDevices(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const onlineCount = useMemo(() => devices.filter((d) => d.online).length, [devices]);
  const offlineCount = useMemo(() => devices.filter((d) => !d.online).length, [devices]);
  const expiredCount = useMemo(() => devices.filter((d) => isExpired(d.session_expires_at)).length, [devices]);

  const filteredDevices = useMemo(() => {
    let list = devices;
    if (filterTab === "online") list = list.filter((d) => d.online);
    else if (filterTab === "offline") list = list.filter((d) => !d.online);
    else if (filterTab === "expired") list = list.filter((d) => isExpired(d.session_expires_at));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) => d.device_name.toLowerCase().includes(q) || d.device_id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [devices, filterTab, searchQuery]);

  // Chart data
  const statusData = [
    { name: "Online", value: onlineCount, color: "#9B3C3C" },    // Theme primary
    { name: "Offline", value: offlineCount, color: "#D4B8A0" },  // Theme muted tan
  ].filter((d) => d.value > 0);

  const sessionDurationData = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const d of devices) {
      const mins = d.session_minutes;
      const label = mins <= 30 ? "≤30m" : mins <= 60 ? "31–60m" : mins <= 120 ? "1–2h" : mins <= 480 ? "2–8h" : "8h+";
      buckets[label] = (buckets[label] || 0) + 1;
    }
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [devices]);

  async function handleGenerateToken() {
    if (!token) return;
    if (pairing.device_name.trim().length < 2) return;

    setTokenLoading(true);
    try {
      const res = await api.generateDeviceToken(token, {
        device_name: pairing.device_name.trim(),
        session_minutes: pairing.session_minutes,
      });
      setNewToken(res);
      setPairing({ device_name: "", session_minutes: 120 });
      setShowPairModal(false);
      await fetchDevices();
    } finally {
      setTokenLoading(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteDevice(deleteTarget.device_id, token);
      setDeleteTarget(null);
      await fetchDevices();
    } finally {
      setDeleting(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: devices.length },
    { key: "online", label: "Online", count: onlineCount },
    { key: "offline", label: "Offline", count: offlineCount },
    { key: "expired", label: "Expired", count: expiredCount },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2D2018]">Device Management</h1>
          <p className="mt-1 text-sm text-[#6B5046]">Manage, pair, and monitor your connected systems</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDevices}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-[#9B3C3C] text-white hover:bg-[#843333]"
            onClick={() => setShowPairModal(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Pair Device
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#8A7060]">Total</p>
                <p className="mt-1 text-3xl font-bold text-[#2D2018]">{devices.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <Monitor className="h-5 w-5 text-[#9B3C3C]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#8A7060]">Online</p>
                <p className="mt-1 text-3xl font-bold text-[#9B3C3C]">{onlineCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <Wifi className="h-5 w-5 text-[#9B3C3C]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#8A7060]">Offline</p>
                <p className="mt-1 text-3xl font-bold text-[#8A7060]">{offlineCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <WifiOff className="h-5 w-5 text-[#8A7060]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E8DDD4] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#8A7060]">Expired</p>
                <p className="mt-1 text-3xl font-bold text-[#6B5046]">{expiredCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <AlertTriangle className="h-5 w-5 text-[#6B5046]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {devices.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-[#E8DDD4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#2D2018]">Device Status</CardTitle>
              <CardDescription className="text-xs text-[#8A7060]">Online vs offline distribution</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8DDD4" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {statusData.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-[#6B5046]">{item.name}</span>
                      <span className="ml-auto text-sm font-bold text-[#2D2018]">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-[#E8DDD4]">
                    <p className="text-xs text-[#8A7060]">
                      {devices.length > 0
                        ? `${Math.round((onlineCount / devices.length) * 100)}% availability`
                        : "No devices"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E8DDD4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#2D2018]">Session Durations</CardTitle>
              <CardDescription className="text-xs text-[#8A7060]">Distribution of configured session lengths</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              {sessionDurationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={sessionDurationData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A7060" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8A7060" }} axisLine={false} tickLine={false} width={25} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8DDD4" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {sessionDurationData.map((_, i) => (
                        <Cell key={i} fill={["#9B3C3C", "#5C3D2E", "#C9A48C", "#6B5046", "#D4B8A0"][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[180px] items-center justify-center text-sm text-[#8A7060]">
                  No data
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pair Device Modal */}
      <Dialog open={showPairModal} onOpenChange={setShowPairModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pair New Device</DialogTitle>
            <DialogDescription>
              Generate a secure pairing token for the Local Helper app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="device-name" className="text-sm font-medium text-[#5C3D2E]">Device name</Label>
              <Input
                id="device-name"
                className="border-[#D4B8A0] bg-white text-[#2D2018]"
                placeholder="e.g. Design-Laptop-01"
                value={pairing.device_name}
                onChange={(e) => setPairing((p) => ({ ...p, device_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-minutes" className="text-sm font-medium text-[#5C3D2E]">Session duration (minutes)</Label>
              <Input
                id="session-minutes"
                type="number"
                min={15}
                max={1440}
                className="border-[#D4B8A0] bg-white text-[#2D2018]"
                value={pairing.session_minutes}
                onChange={(e) => {
                  const value = Number(e.target.value || 120);
                  setPairing((p) => ({ ...p, session_minutes: value }));
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPairModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#9B3C3C] text-white hover:bg-[#843333]"
              onClick={handleGenerateToken}
              disabled={tokenLoading || pairing.device_name.trim().length < 2}
            >
              <Plus className="mr-2 h-4 w-4" />
              {tokenLoading ? "Generating..." : "Generate Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Token */}
      {newToken && (
        <Card className="border-[#C9A48C] bg-[#FAF5F0]/30 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF5F0]">
                  <Check className="h-4 w-4 text-[#9B3C3C]" />
                </div>
                <div>
                  <CardTitle className="text-base text-[#2D2018]">Token Generated</CardTitle>
                  <CardDescription className="text-[#6B5046]">
                    {newToken.device_name} — {newToken.device_id}
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setNewToken(null)} className="h-8 w-8 text-[#8A7060]">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-start">
              <code className="w-full min-w-0 break-all rounded-lg bg-white p-3 text-xs leading-relaxed text-[#2D2018] border border-[#E8DDD4]">
                {newToken.device_token}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => copyToClipboard(newToken.device_token)}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div className="grid gap-2 text-sm text-[#6B5046] sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-[#8A7060]" />
                Session: {newToken.session_minutes} minutes
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[#8A7060]" />
                Expires: {formatDate(newToken.expires_at)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-[#E8DDD4] bg-white p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                filterTab === tab.key
                  ? "bg-[#9B3C3C] text-white shadow-sm"
                  : "text-[#6B5046] hover:text-[#2D2018] hover:bg-[#FAF5F0]"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 ${filterTab === tab.key ? "text-white/60" : "text-[#8A7060]"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8A7060]" />
          <Input
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full border-[#E8DDD4] bg-white pl-9 text-sm sm:w-64"
          />
        </div>
      </div>

      {/* Device Grid */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {filteredDevices.map((device) => {
          const expired = isExpired(device.session_expires_at);
          return (
            <Card
              key={device.device_id}
              className={`group border bg-white shadow-sm transition-all hover:shadow-md ${
                expired
                  ? "border-[#D4B8A0]"
                  : device.online
                    ? "border-[#E8DDD4] hover:border-[#C9A48C]"
                    : "border-[#E8DDD4]"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => device.online && navigate(`/app/navigate/${device.device_id}`)}
                  >
                    <div className={`relative flex h-10 w-10 items-center justify-center rounded-lg ${
                      device.online ? "bg-[#FAF5F0]" : expired ? "bg-[#FAF5F0]" : "bg-[#FAF5F0]"
                    }`}>
                      <Monitor className={`h-5 w-5 ${
                        device.online ? "text-[#9B3C3C]" : expired ? "text-[#6B5046]" : "text-[#8A7060]"
                      }`} />
                      {device.online && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FAF5F0] opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FAF5F0] border-2 border-white" />
                        </span>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold text-[#2D2018] ${device.online ? "group-hover:text-[#9B3C3C]" : ""} transition-colors`}>
                        {device.device_name}
                      </p>
                      <p className="text-[11px] font-mono text-[#8A7060]">{device.device_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      className={
                        expired
                          ? "bg-[#FAF5F0] text-[#6B5046] border-[#D4B8A0]"
                          : device.online
                            ? "bg-[#FAF5F0] text-[#9B3C3C] border-[#C9A48C]"
                            : "bg-[#FAF5F0] text-[#6B5046] border-[#E8DDD4]"
                      }
                    >
                      {expired ? "Expired" : device.online ? "Online" : "Offline"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#D4B8A0] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(device);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#FAF5F0] px-2.5 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#8A7060]">Resolution</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#2D2018]">
                      {device.screen_width > 0 ? `${device.screen_width}×${device.screen_height}` : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#FAF5F0] px-2.5 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#8A7060]">Session</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#2D2018]">{device.session_minutes}m</p>
                  </div>
                  <div className={`rounded-lg px-2.5 py-2 ${expired ? "bg-[#FAF5F0]" : "bg-[#FAF5F0]"}`}>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#8A7060]">Status</p>
                    <p className={`mt-0.5 text-xs font-semibold ${expired ? "text-[#6B5046]" : "text-[#2D2018]"}`}>
                      {timeRemaining(device.session_expires_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-[#8A7060]">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {formatDate(device.session_expires_at)}
                  </span>
                  {device.online && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-[#9B3C3C] hover:text-[#843333] hover:bg-[#FAF5F0]"
                      onClick={() => navigate(`/app/navigate/${device.device_id}`)}
                    >
                      Connect →
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredDevices.length === 0 && (
          <Card className="border-[#E8DDD4] bg-white shadow-sm lg:col-span-2 xl:col-span-3">
            <CardContent className="flex flex-col items-center justify-center py-16 text-[#8A7060]">
              <Monitor className="mb-3 h-12 w-12 text-[#D4B8A0]" />
              <p className="text-sm font-medium">
                {devices.length === 0
                  ? "No devices registered yet"
                  : "No devices match your filter"}
              </p>
              <p className="mt-1 text-xs">
                {devices.length === 0
                  ? "Click \"Pair Device\" to generate a token"
                  : "Try adjusting your search or filter"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.device_name}</strong> ({deleteTarget?.device_id})?
              This will remove the device pairing and disconnect it if online. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
