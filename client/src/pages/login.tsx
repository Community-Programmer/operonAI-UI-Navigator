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
      setAuth(res.token, res.user_id, res.username);
      navigate("/app/devices", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_#F5EDE8_0%,_#FAF5F0_40%,_#FEFCFA_100%)] p-4">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#D4B8A0]/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-60 w-60 rounded-full bg-[#C9A48C]/25 blur-3xl" />

      <Card className="z-10 w-full max-w-md border-[#E8DDD4]/60 bg-white/80 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-4">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[#6B5046] hover:text-[#2D2018]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#9B3C3C] text-white">
              <Navigation className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl text-[#2D2018]">Welcome back</CardTitle>
            <CardDescription className="text-[#6B5046]">Sign in to continue to your device dashboard</CardDescription>
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
              <Label htmlFor="login-user" className="text-[#5C3D2E]">Username</Label>
              <Input
                id="login-user"
                className="border-[#D4B8A0] bg-white text-[#2D2018] placeholder:text-[#8A7060]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-pass" className="text-[#5C3D2E]">Password</Label>
              <Input
                id="login-pass"
                type="password"
                className="border-[#D4B8A0] bg-white text-[#2D2018] placeholder:text-[#8A7060]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full bg-[#9B3C3C] text-white hover:bg-[#843333]" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-[#6B5046]">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-[#9B3C3C] hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
