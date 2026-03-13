import { Link } from "react-router-dom";
import { ArrowRight, MonitorSmartphone, Radio, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: MonitorSmartphone,
    title: "Remote UI Navigation",
    description: "Control desktop workflows with AI-guided actions and live visual context.",
  },
  {
    icon: Radio,
    title: "Voice-Controlled Sessions",
    description: "Drive your connected devices naturally through real-time voice interaction.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Device Pairing",
    description: "Use token-based pairing and authenticated sessions across your dashboard.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_15%_15%,_#d6f0f8_0%,_#eff8fc_35%,_#f6f8fb_70%)] text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-900">UI Navigator</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-slate-700 hover:bg-white/70 hover:text-slate-900" asChild>
            <Link to="/login">Login</Link>
          </Button>
          <Button className="bg-slate-900 text-white hover:bg-slate-800" asChild>
            <Link to="/signup">Sign up</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <section>
          <p className="mb-4 inline-flex items-center rounded-full border border-sky-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-sky-900">
            Desktop automation and navigation platform
          </p>

          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
            Navigate any desktop workflow with confidence, speed, and control
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base text-slate-600 md:text-lg">
            UI Navigator combines live screenshots, voice interaction, and intelligent action planning
            to help teams operate remote desktops in a clean, centralized workflow.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" className="gap-2 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/signup">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-slate-300 bg-white/70 text-slate-800 hover:bg-white" asChild>
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          {features.map((item) => (
            <Card key={item.title} className="border-white/70 bg-white/70 shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                  <item.icon className="h-4 w-4 text-cyan-700" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
