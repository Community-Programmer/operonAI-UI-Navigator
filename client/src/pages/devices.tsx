import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Copy, Monitor, Plus, RefreshCw, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import type { DeviceInfo, PairDeviceRequest, TokenResponse } from "@/types";

function formatDate(value: string) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleString();
}

export function DevicesPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [newToken, setNewToken] = useState<TokenResponse | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function handleGenerateToken() {
    if (!token) return;
    if (pairing.device_name.trim().length < 2) {
      return;
    }

    setTokenLoading(true);
    try {
      const res = await api.generateDeviceToken(token, {
        device_name: pairing.device_name.trim(),
        session_minutes: pairing.session_minutes,
      });
      setNewToken(res);
      await fetchDevices();
    } finally {
      setTokenLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Device Management</h1>
          <p className="text-sm text-slate-600">Create pairing tokens and monitor system availability</p>
        </div>
        <Button variant="outline" onClick={fetchDevices} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 bg-white/90">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600">Total Devices</CardDescription>
            <CardTitle className="text-3xl text-slate-900">{devices.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 bg-white/90">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600">Currently Online</CardDescription>
            <CardTitle className="text-3xl text-slate-900">{onlineCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 bg-white/90">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600">Offline</CardDescription>
            <CardTitle className="text-3xl text-slate-900">{Math.max(0, devices.length - onlineCount)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white/90">
        <CardHeader>
          <CardTitle className="text-slate-900">Pair New Device</CardTitle>
          <CardDescription className="text-slate-600">
            Enter device details to generate a secure token for the Local Helper app.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_200px_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="device-name" className="text-slate-700">Device name</Label>
            <Input
              id="device-name"
              className="border-slate-300 bg-white text-slate-900"
              placeholder="Example: Design-Laptop-01"
              value={pairing.device_name}
              onChange={(e) => setPairing((p) => ({ ...p, device_name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-minutes" className="text-slate-700">Session duration (minutes)</Label>
            <Input
              id="session-minutes"
              type="number"
              min={15}
              max={1440}
              className="border-slate-300 bg-white text-slate-900"
              value={pairing.session_minutes}
              onChange={(e) => {
                const value = Number(e.target.value || 120);
                setPairing((p) => ({ ...p, session_minutes: value }));
              }}
            />
          </div>

          <Button
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={handleGenerateToken}
            disabled={tokenLoading || pairing.device_name.trim().length < 2}
          >
            <Plus className="mr-2 h-4 w-4" />
            {tokenLoading ? "Generating..." : "Generate token"}
          </Button>
        </CardContent>
      </Card>

      {newToken && (
        <Card className="border-blue-200 bg-blue-50/70">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Generated Pairing Token</CardTitle>
            <CardDescription className="text-slate-600">
              Device: <strong>{newToken.device_name}</strong> | ID: <strong>{newToken.device_id}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-start">
              <code className="w-full min-w-0 break-all rounded bg-white p-2 text-xs leading-relaxed text-slate-800">
                {newToken.device_token}
              </code>
              <Button
                variant="outline"
                className="border-slate-300 bg-white"
                onClick={() => copyToClipboard(newToken.device_token)}
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy token"}
              </Button>
            </div>
            <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Session: {newToken.session_minutes} minutes
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Expires: {formatDate(newToken.expires_at)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {devices.map((device) => (
          <Card
            key={device.device_id}
            className="cursor-pointer border-slate-200 bg-white/90 transition-all hover:border-slate-300 hover:shadow-sm"
            onClick={() => device.online && navigate(`/app/navigate/${device.device_id}`)}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base text-slate-900">{device.device_name}</CardTitle>
                  <CardDescription className="text-slate-600">{device.device_id}</CardDescription>
                </div>
                <Badge className={device.online ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"}>
                  {device.online ? "Online" : "Offline"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                {device.screen_width > 0
                  ? `${device.screen_width} x ${device.screen_height}`
                  : "Resolution unavailable"}
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Session: {device.session_minutes} minutes
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Expires: {formatDate(device.session_expires_at)}
              </div>
            </CardContent>
          </Card>
        ))}

        {devices.length === 0 && (
          <Card className="border-slate-200 bg-white/90 lg:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-slate-600">
              <Monitor className="mb-3 h-10 w-10 text-slate-300" />
              <p>No devices registered yet. Generate a pairing token to begin.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
