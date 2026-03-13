import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock3, Monitor } from "lucide-react";

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

export function SystemsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [systems, setSystems] = useState<DeviceInfo[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchSystems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.getActiveSystems(token);
      setSystems(res.systems);
      setOnlineCount(res.online_count);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSystems();
    const id = window.setInterval(fetchSystems, 5000);
    return () => window.clearInterval(id);
  }, [fetchSystems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Active Systems</h1>
          <p className="text-sm text-slate-600">Live overview of currently connected desktops</p>
        </div>
        <Button variant="outline" onClick={fetchSystems} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 bg-white/90">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600">Online systems</CardDescription>
            <CardTitle className="text-3xl text-slate-900">{onlineCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 bg-white/90">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600">Tracked devices</CardDescription>
            <CardTitle className="text-3xl text-slate-900">{systems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 bg-white/90">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600">Last refresh</CardDescription>
            <CardTitle className="text-base text-slate-900">{new Date().toLocaleTimeString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {systems.length === 0 && (
          <Card className="border-slate-200 bg-white/90 lg:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-slate-600">
              <Activity className="mb-3 h-10 w-10 text-slate-300" />
              <p>No active systems right now.</p>
            </CardContent>
          </Card>
        )}

        {systems.map((system) => (
          <Card
            key={system.device_id}
            className="cursor-pointer border-slate-200 bg-white/90 transition-all hover:border-slate-300 hover:shadow-sm"
            onClick={() => navigate(`/app/navigate/${system.device_id}`)}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-slate-900">{system.device_name}</CardTitle>
                  <CardDescription className="text-slate-600">{system.device_id}</CardDescription>
                </div>
                <Badge className="bg-emerald-600 text-white">Online</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span>Resolution: {system.screen_width} x {system.screen_height}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                <span>Session expires: {formatDate(system.session_expires_at)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
