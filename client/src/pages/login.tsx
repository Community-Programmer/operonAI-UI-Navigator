import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import { ArrowLeft, Navigation } from "lucide-react";

export function LoginPage() {
  const { isLoggedIn, setAuth } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isLoggedIn) {
    navigate("/app/devices", { replace: true });
    return null;
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await api.login({ username, password });
      setAuth(res.token, res.user_id);
      navigate("/app/devices", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_#d8eef8_0%,_#f7fbfd_40%,_#f6f8fb_100%)] p-4">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-60 w-60 rounded-full bg-blue-200/40 blur-3xl" />

      <Card className="z-10 w-full max-w-md border-white/60 bg-white/80 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-4">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Navigation className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl text-slate-900">Welcome back</CardTitle>
            <CardDescription className="text-slate-600">Sign in to continue to your device dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="login-user" className="text-slate-700">Username</Label>
              <Input
                id="login-user"
                className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-pass" className="text-slate-700">Password</Label>
              <Input
                id="login-pass"
                type="password"
                className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-slate-900 hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
