import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Cpu,
  Eye,
  Layers,
  LogOut,
  Mic,
  MonitorSmartphone,
  MousePointerClick,
  Radio,
  ScrollText,
  Settings,
  ShieldCheck,
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
    bg: "bg-blue-500/10",
    iconColor: "text-blue-600",
  },
  {
    icon: Mic,
    title: "Voice-Powered Interaction",
    description:
      "Simply speak your intent — the agent listens, acknowledges, and executes tasks in real time with natural conversation flow.",
    bg: "bg-violet-500/10",
    iconColor: "text-violet-600",
  },
  {
    icon: Bot,
    title: "AI Agent Loop",
    description:
      "Observe, Plan, Act, Verify. The agent autonomously decomposes goals into steps, executes them, and verifies completion.",
    bg: "bg-emerald-500/10",
    iconColor: "text-emerald-600",
  },
  {
    icon: ShieldCheck,
    title: "Secure Device Pairing",
    description:
      "Token-based authentication with JWT sessions, encrypted WebSocket channels, and per-user device isolation.",
    bg: "bg-amber-500/10",
    iconColor: "text-amber-600",
  },
  {
    icon: ScrollText,
    title: "Full Session Logging",
    description:
      "Every command, screenshot, reasoning step, and action is logged and reviewable with a detailed timeline.",
    bg: "bg-rose-500/10",
    iconColor: "text-rose-600",
  },
  {
    icon: Layers,
    title: "Visual Perception Engine",
    description:
      "YOLO object detection + OCR identifies every UI element — buttons, inputs, menus — with typed, structured understanding.",
    bg: "bg-slate-500/10",
    iconColor: "text-slate-600",
  },
];

const workflow = [
  {
    step: "01",
    title: "Connect Your Device",
    description: "Generate a pairing token and connect your Windows desktop in seconds.",
    icon: Cpu,
    color: "from-blue-600 to-cyan-500",
  },
  {
    step: "02",
    title: "Describe Your Goal",
    description: "Type or speak what you need done — the AI decomposes it into a step-by-step plan.",
    icon: MousePointerClick,
    color: "from-violet-600 to-purple-500",
  },
  {
    step: "03",
    title: "Watch It Execute",
    description: "The agent navigates the UI autonomously — clicking, typing, scrolling — with live screenshots.",
    icon: Zap,
    color: "from-amber-500 to-orange-500",
  },
  {
    step: "04",
    title: "Review & Monitor",
    description: "Every action, screenshot, and reasoning step is recorded in a searchable session log.",
    icon: ScrollText,
    color: "from-emerald-600 to-teal-500",
  },
];

export function LandingPage() {
  const { isLoggedIn, username, userId, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = username ?? userId?.slice(0, 8) ?? "User";
  const initials = username?.slice(0, 2).toUpperCase() ?? userId?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <div className="min-h-svh bg-white text-slate-900">
      {/* ───── Navbar ───── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/50 bg-white/70 backdrop-blur-xl">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="Logo" className="h-8 w-30 rounded-lg object-contain" />
          </Link>

          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus:outline-none">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-violet-600 text-[11px] font-bold text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-slate-700">
                    {displayName}
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
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white pt-14">
        {/* Subtle background shapes */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-100/40 blur-3xl" />
          <div className="absolute -right-40 top-10 h-[500px] w-[500px] rounded-full bg-violet-100/30 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 md:pt-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: Copy */}
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-blue-50/80 px-4 py-1.5 text-xs font-medium text-blue-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
                </span>
                AI-Powered Desktop Automation
              </div>

              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
                Control any desktop{" "}
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  with AI
                </span>
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-500">
                An AI agent that observes your screen, plans actions, executes
                them autonomously, and verifies results — through text or voice.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="gap-2 bg-slate-900 px-7 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
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
                  className="gap-2 border-slate-200 px-7 text-slate-700 shadow-sm hover:bg-slate-50"
                  asChild
                >
                  <Link to={isLoggedIn ? "/app/sessions" : "/login"}>
                    {isLoggedIn ? "View Sessions" : "I have an account"}
                  </Link>
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
                {["No credit card required", "Encrypted connections", "Full session logging"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Floating badges visual */}
            <div className="relative hidden lg:flex lg:items-center lg:justify-center lg:min-h-[340px]">
              {/* Decorative rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-64 w-64 rounded-full border border-slate-200/50" />
                <div className="absolute h-48 w-48 rounded-full border border-slate-200/30" />
                <div className="absolute h-80 w-80 rounded-full border border-dashed border-slate-100" />
              </div>

              {/* Task Complete badge */}
              <div className="absolute right-8 top-8 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                    <Check className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-800">Task Complete</p>
                    <p className="text-[10px] text-slate-400">12 actions executed</p>
                  </div>
                </div>
              </div>

              {/* Voice Ready badge */}
              <div className="absolute bottom-8 left-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
                    <Mic className="h-4.5 w-4.5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-800">Voice Ready</p>
                    <p className="text-[10px] text-slate-400">Speak your command</p>
                  </div>
                </div>
              </div>

              {/* Center icon */}
              <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-xl shadow-blue-500/25">
                <Bot className="h-9 w-9 text-white" />
              </div>

              {/* Extra decorative badge */}
              <div className="absolute left-12 top-16 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-slate-600">3 systems online</span>
                </div>
              </div>

              <div className="absolute bottom-16 right-12 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3 w-3 text-blue-500" />
                  <span className="text-[10px] font-medium text-slate-600">Live monitoring</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Agent Loop Process ───── */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Core Process
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              An autonomous loop that gets things done
            </h2>
            <p className="mt-3 text-base text-slate-500">
              Every task follows a rigorous four-phase cycle — ensuring reliability at each step.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {(
                [
                  { label: "Observe", desc: "Capture & parse the screen using YOLO + OCR", Icon: Eye, color: "border-blue-200 bg-blue-50 text-blue-700" },
                  { label: "Plan", desc: "Decompose the user's goal into actionable steps", Icon: Bot, color: "border-violet-200 bg-violet-50 text-violet-700" },
                  { label: "Act", desc: "Execute precise clicks, typing, and scrolling", Icon: Zap, color: "border-amber-200 bg-amber-50 text-amber-700" },
                  { label: "Verify", desc: "Confirm each action completed successfully", Icon: ShieldCheck, color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                ] as const
              ).map((item, i) => (
                <div key={item.label} className="relative">
                  <div className={`flex flex-col items-center rounded-xl border px-4 py-5 text-center ${item.color}`}>
                    <item.Icon className="h-7 w-7" />
                    <p className="mt-3 text-sm font-bold">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-snug opacity-70">{item.desc}</p>
                  </div>
                  {i < 3 && (
                    <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-slate-300 md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── Features Grid ───── */}
      <section className="border-t border-slate-100 bg-slate-50/50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Capabilities
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Everything you need to automate desktop workflows
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-500">
              From visual perception to voice control — a complete toolkit
              for intelligent desktop automation.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-lg"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.bg}`}
                >
                  <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
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
      <section className="border-t border-slate-100 py-16 md:py-24">
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
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} shadow-lg`}>
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

      {/* ───── Showcase Section ───── */}
      <section className="border-t border-slate-100 bg-slate-50/50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: Content */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
                Real-Time Navigation
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Watch the agent work in real time
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                Every click, scroll, and keystroke happens on a live stream of the desktop.
                The agent explains its reasoning as it progresses through each step.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Live screenshot streaming via WebSocket",
                  "Step-by-step reasoning displayed in real time",
                  "Instant voice command acknowledgment",
                  "Progress verification after every action",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Right: Image */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1551650975-87deedd944c3?w=700&h=500&fit=crop&auto=format"
                alt="Real-time desktop navigation interface"
                className="h-auto w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ───── Showcase 2 ───── */}
      <section className="border-t border-slate-100 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: Image */}
            <div className="order-2 lg:order-1 overflow-hidden rounded-2xl border border-slate-200 shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=700&h=500&fit=crop&auto=format"
                alt="Detailed session monitoring and analytics"
                className="h-auto w-full object-cover"
              />
            </div>
            {/* Right: Content */}
            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold uppercase tracking-wider text-rose-600">
                Session Intelligence
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Complete audit trail for every task
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                Every session is fully logged with screenshots, agent reasoning,
                executed actions, and verification results — all in a searchable timeline.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Timestamped screenshots for every iteration",
                  "Agent reasoning and decision logs",
                  "Action-by-action execution history",
                  "Final verification with progress tracking",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───── CTA Section ───── */}
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 md:p-16">
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
          <div className="flex items-center">
            <img src="/logo.png" alt="Logo" className="h-8 w-30 rounded-lg object-contain" />
          </div>
          <p className="text-xs text-slate-400">
            AI-powered desktop automation
          </p>
        </div>
      </footer>
    </div>
  );
}
