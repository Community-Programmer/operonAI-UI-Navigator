import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  ChevronRight,
  Cpu,
  Layers,
  LogOut,
  Mic,
  MonitorSmartphone,
  MousePointerClick,
  Radio,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

const features = [
  {
    icon: MonitorSmartphone,
    title: "Remote Desktop Control",
    description:
      "Take full control of any connected Windows desktop through an intelligent agent that sees, reasons, and acts on your behalf.",
    color: "from-blue-600 to-cyan-500",
    bg: "bg-blue-50",
  },
  {
    icon: Mic,
    title: "Voice-Powered Interaction",
    description:
      "Simply speak your intent — the agent listens, acknowledges, and executes tasks in real time with natural conversation flow.",
    color: "from-violet-600 to-purple-500",
    bg: "bg-violet-50",
  },
  {
    icon: Bot,
    title: "AI Agent Loop",
    description:
      "Observe → Plan → Act → Verify. The agent autonomously decomposes goals into steps, executes them, and verifies completion.",
    color: "from-emerald-600 to-teal-500",
    bg: "bg-emerald-50",
  },
  {
    icon: ShieldCheck,
    title: "Secure Device Pairing",
    description:
      "Token-based authentication with JWT sessions, encrypted WebSocket channels, and per-user device isolation.",
    color: "from-amber-600 to-orange-500",
    bg: "bg-amber-50",
  },
  {
    icon: ScrollText,
    title: "Full Session Logging",
    description:
      "Every command, screenshot, reasoning step, and action is logged and reviewable with a detailed timeline in the monitoring dashboard.",
    color: "from-rose-600 to-pink-500",
    bg: "bg-rose-50",
  },
  {
    icon: Layers,
    title: "Visual Perception Engine",
    description:
      "YOLO object detection + OCR identifies every UI element — buttons, inputs, menus — giving the agent typed, structured understanding.",
    color: "from-slate-600 to-slate-500",
    bg: "bg-slate-100",
  },
];

const workflow = [
  {
    step: "01",
    title: "Connect Your Device",
    description: "Generate a pairing token and connect your Windows desktop in seconds.",
    icon: Cpu,
  },
  {
    step: "02",
    title: "Describe Your Goal",
    description: "Type or speak what you need done — the AI decomposes it into a step-by-step plan.",
    icon: MousePointerClick,
  },
  {
    step: "03",
    title: "Watch It Execute",
    description: "The agent navigates the UI autonomously — clicking, typing, scrolling — with live screenshots.",
    icon: Zap,
  },
  {
    step: "04",
    title: "Review & Monitor",
    description: "Every action, screenshot, and reasoning step is recorded in a searchable session log.",
    icon: ScrollText,
  },
];

export function LandingPage() {
  const { isLoggedIn, userId, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-svh bg-white text-slate-900">
      {/* ───── Navbar ───── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-lg">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              UI Navigator
            </span>
          </Link>

          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus:outline-none">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-violet-600 text-[11px] font-bold text-white">
                      {userId?.slice(0, 2).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-slate-700">
                    {userId?.slice(0, 8)}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/app/systems")}>
                  <Radio className="mr-2 h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/sessions")}>
                  <ScrollText className="mr-2 h-4 w-4" />
                  Session Logs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/devices")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Devices
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900"
                asChild
              >
                <Link to="/login">Log in</Link>
              </Button>
              <Button
                size="sm"
                className="bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                asChild
              >
                <Link to="/signup">
                  Get started
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </nav>
      </header>

      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-100/50 blur-3xl" />
          <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-violet-100/40 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-px w-full max-w-6xl -translate-x-1/2 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-blue-50/70 px-4 py-1.5 text-xs font-medium text-blue-700 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>
              AI-Powered Desktop Automation Platform
            </div>

            {/* Headline */}
            <h1 className="text-balance text-4xl font-bold leading-[1.15] tracking-tight text-slate-900 md:text-6xl">
              Control any desktop
              <span className="relative mx-2">
                <span className="relative z-10 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  with AI
                </span>
              </span>
              that sees, thinks, and acts
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-500 md:text-xl">
              UI Navigator gives you an AI agent that observes your screen, plans actions,
              executes them autonomously, and verifies results — through text or voice.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="gap-2 bg-slate-900 px-6 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/25"
                asChild
              >
                <Link to={isLoggedIn ? "/app/systems" : "/signup"}>
                  {isLoggedIn ? "Go to Dashboard" : "Start for Free"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-slate-200 bg-white px-6 text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md"
                asChild
              >
                <Link to={isLoggedIn ? "/app/sessions" : "/login"}>
                  {isLoggedIn ? "View Sessions" : "I have an account"}
                </Link>
              </Button>
            </div>
          </div>

          {/* Agent Loop Visual */}
          <div className="mx-auto mt-16 max-w-3xl">
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-1 shadow-xl shadow-slate-200/50">
              <div className="rounded-xl bg-white p-6 md:p-8">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {(
                    [
                      { label: "Observe", desc: "Capture screen", icon: "👁️", color: "bg-blue-50 border-blue-200 text-blue-700" },
                      { label: "Plan", desc: "Decompose goal", icon: "🧠", color: "bg-violet-50 border-violet-200 text-violet-700" },
                      { label: "Act", desc: "Execute actions", icon: "⚡", color: "bg-amber-50 border-amber-200 text-amber-700" },
                      { label: "Verify", desc: "Check progress", icon: "✓", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                    ] as const
                  ).map((item, i) => (
                    <div key={item.label} className="relative">
                      <div className={`rounded-xl border p-4 text-center ${item.color}`}>
                        <div className="text-2xl">{item.icon}</div>
                        <p className="mt-2 text-sm font-semibold">{item.label}</p>
                        <p className="mt-0.5 text-[11px] opacity-70">{item.desc}</p>
                      </div>
                      {i < 3 && (
                        <ChevronRight className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-slate-300 md:block" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Features Grid ───── */}
      <section className="border-t border-slate-100 bg-slate-50/50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Capabilities
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Everything you need to automate desktop workflows
            </h2>
            <p className="mt-4 text-base text-slate-500">
              From visual perception to voice control, UI Navigator provides a complete toolkit
              for intelligent desktop automation.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-lg"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${feature.bg}`}
                >
                  <feature.icon className="h-5 w-5 text-slate-700" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── How It Works ───── */}
      <section className="border-t border-slate-100 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              From goal to done in four steps
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item, i) => (
              <div key={item.step} className="relative">
                {i < workflow.length - 1 && (
                  <div className="absolute left-full top-8 hidden w-8 border-t-2 border-dashed border-slate-200 lg:block" />
                )}
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 shadow-lg shadow-slate-900/10">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Step {item.step}
                </p>
                <h3 className="mt-1.5 text-[15px] font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA Section ───── */}
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 md:p-16">
            {/* Glow effects */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Ready to automate your desktop?
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-400">
                Connect a device, describe your goal, and let the AI agent handle the rest.
                Full session logging and monitoring included.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  className="bg-white px-8 text-slate-900 shadow-lg hover:bg-slate-100"
                  asChild
                >
                  <Link to={isLoggedIn ? "/app/systems" : "/signup"}>
                    {isLoggedIn ? "Open Dashboard" : "Get Started Free"}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="border-t border-slate-100 bg-slate-50/50 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
              <Sparkles className="h-3 w-3" />
            </div>
            <span className="text-xs font-medium text-slate-500">UI Navigator</span>
          </div>
          <p className="text-xs text-slate-400">
            AI-powered desktop automation
          </p>
        </div>
      </footer>
    </div>
  );
}
