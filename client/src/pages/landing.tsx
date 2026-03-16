import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Apple,
  ArrowRight,
  Check,
  LogOut,
  Monitor,
  Radio,
  ScrollText,
  Settings,
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
import { BackgroundLines } from "@/components/ui/background-lines";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

type FeatureImage = {
  src: string;
  alt: string;
};

type Feature = {
  id: string;
  title: string;
  desc: string;
  images: FeatureImage[];
};

function ImagesCarousel({ images }: { images: FeatureImage[] }) {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api || images.length <= 1) return;

    const timer = window.setInterval(() => {
      api.scrollNext();
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [api, images.length]);

  return (
    <Carousel
      className="w-full"
      opts={{ loop: true, align: "start" }}
      setApi={setApi}
    >
      <CarouselContent>
        {images.map((img) => (
          <CarouselItem key={img.src} className="basis-full">
            <div className="overflow-hidden rounded-2xl border border-[#E8DDD4] bg-[#F6EEE8]">
              <AspectRatio ratio={16 / 9}>
                <img
                  className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                />
              </AspectRatio>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
      {features.map((feature) => (
        <CardContainer
          key={feature.id}
          containerClassName="w-full items-stretch justify-stretch py-0"
          className="w-full"
        >
          <CardBody className="group/card h-auto w-full rounded-3xl border border-[#E8DDD4] bg-white p-4 shadow-[0_16px_40px_rgba(125,76,44,0.10)] transition-shadow hover:shadow-[0_20px_50px_rgba(125,76,44,0.16)] sm:p-5">
            <CardItem translateZ="30" className="w-full">
              <ImagesCarousel images={feature.images} />
            </CardItem>
            <CardItem translateZ="35" className="mt-4 text-2xl font-semibold tracking-tight text-[#2D2018] sm:text-3xl">
              {feature.title}
            </CardItem>
            <CardItem as="p" translateZ="25" className="mt-3 max-w-xl text-base leading-relaxed text-[#6B5046]">
              {feature.desc}
            </CardItem>
          </CardBody>
        </CardContainer>
      ))}
    </div>
  );
}

function ProcessSteps() {
  const stepsData = [
    {
      num: 1,
      title: "Device Pairing",
      items: ["Token-based onboarding", "Secure connection", "Instant access"],
      color: "bg-[#E8DDD4] text-[#2D2018]"
    },
    {
      num: 2,
      title: "Goal Formulation",
      items: ["Natural language input", "Voice command analysis", "Intent understanding"],
      color: "bg-[#C9A48C] text-[#2D2018]"
    },
    {
      num: 3,
      title: "AI Execution",
      items: ["Observe screen context", "Plan and execute", "Verify outcomes"],
      color: "bg-[#9B3C3C] text-white"
    },
    {
      num: 4,
      title: "Session Audit",
      items: ["Full execution logging", "Action timeline replay", "Deep performance metrics"],
      color: "bg-[#5C3D2E] text-white"
    }
  ];

  return (
    <section className="bg-[#FAF5F0] py-20 md:py-32 overflow-hidden border-y border-[#E8DDD4]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
        <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-[#2D2018] sm:text-4xl md:text-5xl mb-4 md:mb-16 leading-[1.15]">
          From natural language to automated execution <span className="text-[#9B3C3C]">in 4 simple steps</span>
        </h2>

        {/* Mobile View */}
        <div className="mt-12 flex flex-col items-center gap-4 md:hidden">
          {stepsData.map((step) => (
            <div 
              key={step.num}
              className={`flex flex-col items-center justify-center p-8 text-center ${step.color}`}
              style={{ 
                width: 280, 
                height: 242, 
                clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' 
              }}
            >
              <h3 className="text-lg font-bold mb-3">{step.num}. {step.title}</h3>
              <ul className="text-sm space-y-2 font-medium">
                {step.items.map((item, i) => (
                  <li key={i} className="flex items-center justify-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Desktop View (Honeycomb) */}
        <div className="hidden md:flex flex-col items-center select-none scale-[0.85] lg:scale-100 mt-8 mb-8">
          {/* Step 1 */}
          <div className="z-10 group relative transition-transform hover:scale-105 hover:z-50 duration-300">
            <div 
              className={`flex flex-col items-center justify-center p-8 text-center shadow-[0_10px_40px_rgba(0,0,0,0.1)] ${stepsData[0].color}`}
              style={{ width: 320, height: 277, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
            >
              <h3 className="text-xl font-bold mb-4">{stepsData[0].num}. {stepsData[0].title}</h3>
              <ul className="text-base space-y-2.5 font-medium">
                {stepsData[0].items.map((item, i) => (
                  <li key={i} className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Step 2 & 3 */}
          <div className="flex justify-center -mt-[138px] z-20 gap-[160px]">
            <div className="group relative transition-transform hover:scale-105 hover:z-50 duration-300">
              <div 
                className={`flex flex-col items-center justify-center p-8 text-center shadow-[0_10px_40px_rgba(0,0,0,0.1)] ${stepsData[1].color}`}
                style={{ width: 320, height: 277, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
              >
                <div>
                  <h3 className="text-xl font-bold mb-4">{stepsData[1].num}. {stepsData[1].title}</h3>
                  <ul className="text-base space-y-2.5 font-medium">
                    {stepsData[1].items.map((item, i) => (
                      <li key={i} className="flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="group relative transition-transform hover:scale-105 hover:z-50 duration-300">
              <div 
                className={`flex flex-col items-center justify-center p-8 text-center shadow-[0_10px_40px_rgba(0,0,0,0.1)] ${stepsData[2].color}`}
                style={{ width: 320, height: 277, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
              >
                <div>
                  <h3 className="text-xl font-bold mb-4">{stepsData[2].num}. {stepsData[2].title}</h3>
                  <ul className="text-base space-y-2.5 font-medium">
                    {stepsData[2].items.map((item, i) => (
                      <li key={i} className="flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="z-10 group relative transition-transform hover:scale-105 hover:z-50 duration-300 -mt-[138px]">
            <div 
              className={`flex flex-col items-center justify-center p-8 text-center shadow-[0_10px_40px_rgba(0,0,0,0.1)] ${stepsData[3].color}`}
              style={{ width: 320, height: 277, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
            >
              <h3 className="text-xl font-bold mb-4">{stepsData[3].num}. {stepsData[3].title}</h3>
              <ul className="text-base space-y-2.5 font-medium">
                {stepsData[3].items.map((item, i) => (
                  <li key={i} className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  const { isLoggedIn, username, userId, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = username ?? userId?.slice(0, 8) ?? "User";
  const initials = username?.slice(0, 2).toUpperCase() ?? userId?.slice(0, 2).toUpperCase() ?? "U";

  const devicePairingImgs = useMemo(() => [
    { src: "/devices-1.png", alt: "Secure Device Pairing Preview" },
    { src: "/login1.png", alt: "Device Login and Onboarding" }
  ], []);
  const navigationImgs = useMemo(() => [
    { src: "/app-1.png", alt: "Natural Language Navigation Preview" },
    { src: "/image-11.png", alt: "Automated Execution Demo" }
  ], []);
  const agentLoopImgs = useMemo(() => [
    { src: "/session-1.png", alt: "Observe, Plan, Act, Verify Preview" },
    { src: "/dashboard-1.png", alt: "Verification and Reporting" }
  ], []);
  const voiceControlImgs = useMemo(() => [
    { src: "/dashboard-1.png", alt: "Live Voice Commands Preview" },
    { src: "/app-1.png", alt: "Real-time Action Feedback" }
  ], []);
  const firstFeatureRow = useMemo<Feature[]>(
    () => [
      {
        id: "Device-Pairing",
        title: "Secure Device Pairing",
        desc: "Pair Windows machines in seconds using token-based onboarding. Each device stays isolated per user, with authenticated channels for safe remote control.",
        images: devicePairingImgs,
      },
      {
        id: "Navigation",
        title: "Natural Language Navigation",
        desc: "Describe what you want in plain English. The navigator decomposes your goal into actionable UI steps and executes clicks, typing, and scrolling automatically.",
        images: navigationImgs,
      },
    ],
    [devicePairingImgs, navigationImgs]
  );

  const secondFeatureRow = useMemo<Feature[]>(
    () => [
      {
        id: "Agent-Loop",
        title: "Observe, Plan, Act, Verify",
        desc: "The core automation loop continuously perceives the screen, plans the next action, executes it, and verifies completion so tasks remain reliable end-to-end.",
        images: agentLoopImgs,
      },
      {
        id: "Voice",
        title: "Live Voice Commands",
        desc: "Speak commands naturally while monitoring execution in real time. The assistant acknowledges intent and adapts actions as your context changes.",
        images: voiceControlImgs,
      },
    ],
    [agentLoopImgs, voiceControlImgs]
  );

  return (
    <div className="light min-h-svh bg-white text-[#2D2018]" style={{ colorScheme: "light" }}>
      {/* ───── Navbar ───── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#E8DDD4] bg-white">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="Logo" className="h-8 w-30 rounded-lg object-contain" />
          </Link>

          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 mr-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-[#D4B8A0] text-[#5C3D2E] hover:bg-[#FAF5F0] hover:text-[#9B3C3C]"
                  asChild
                >
                  <a href="https://github.com/ui-navigator/releases/download/latest/operonAI.exe" download>
                    <Monitor className="h-4 w-4" />
                    <span>Windows</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-[#D4B8A0] text-[#5C3D2E] hover:bg-[#FAF5F0] hover:text-[#9B3C3C]"
                  asChild
                >
                  <a href="https://github.com/ui-navigator/releases/download/latest/operonAI.dmg" download>
                    <Apple className="h-4 w-4" />
                    <span>Mac</span>
                  </a>
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-[#E8DDD4] bg-white p-1 pr-3 shadow-sm transition-all hover:border-[#C9AE98] hover:shadow-md focus:outline-none">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-[#9B3C3C] text-[11px] font-bold text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-[#5C3D2E]">
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
                    className="text-[#9B3C3C] focus:text-[#9B3C3C]"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 mr-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-[#D4B8A0] text-[#5C3D2E] hover:bg-[#FAF5F0] hover:text-[#9B3C3C]"
                  asChild
                >
                  <a href="https://github.com/ui-navigator/releases/download/latest/operonAI.exe" download>
                    <Monitor className="h-4 w-4" />
                    <span>Windows</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-[#D4B8A0] text-[#5C3D2E] hover:bg-[#FAF5F0] hover:text-[#9B3C3C]"
                  asChild
                >
                  <a href="https://github.com/ui-navigator/releases/download/latest/operonAI.dmg" download>
                    <Apple className="h-4 w-4" />
                    <span>Mac</span>
                  </a>
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-[#5C3D2E] hover:text-[#9B3C3C]"
                asChild
              >
                <Link to="/login">Log in</Link>
              </Button>
              <Button
                size="sm"
                className="bg-[#9B3C3C] text-white shadow-sm hover:bg-[#843333]"
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

      {/* ───── Hero with Background Lines ───── */}
      <BackgroundLines className="relative flex w-full flex-col items-center !h-auto min-h-[20rem] md:min-h-screen !bg-[#FAF5F0] pt-28 pb-20 sm:pt-32 md:pt-40 md:pb-28">
        <div className="relative z-20 mx-auto max-w-4xl px-4 text-center sm:px-6">
          

          <h1 className="text-3xl font-bold leading-[1.08] tracking-tight text-[#9B3C3C] sm:text-4xl md:text-6xl lg:text-7xl">
            Control any desktop
            <br />
            with AI
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-[#6B5046] sm:text-base md:text-lg">
            An autonomous AI agent that observes your screen, plans actions,
            executes them, and verifies results — through natural language text
            or voice commands.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row">
            <Button
              size="lg"
              className="w-full gap-2 bg-[#9B3C3C] px-8 text-white shadow-lg shadow-[#9B3C3C]/15 hover:bg-[#843333] sm:w-auto"
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
              className="w-full gap-2 border-[#D4B8A0] bg-white px-8 text-[#5C3D2E] shadow-sm hover:bg-[#FAF5F0] sm:w-auto"
              asChild
            >
              <Link to={isLoggedIn ? "/app/sessions" : "/login"}>
                {isLoggedIn ? "View Sessions" : "I have an account"}
              </Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#8A7060] sm:mt-10">
            {["No credit card required", "Encrypted connections", "Full session logging"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#9B3C3C]" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </BackgroundLines>

      <section className="border-t border-[#E8DDD4] bg-[#FAF5F0] py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C9A48C]">
              Product Features
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2018] md:text-5xl">
              Built for autonomous desktop operations
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#6B5046]">
              Explore core platform capabilities with two cards per row and auto-moving previews
              that keep the section active while users scroll.
            </p>
          </div>

          <FeatureGrid features={firstFeatureRow} />
          <FeatureGrid features={secondFeatureRow} />
        </div>
      </section>

      <ProcessSteps />

      {/* ───── CTA Section ───── */}
      <section className="border-t border-[#E8DDD4] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-28">
          <div className="relative overflow-hidden rounded-3xl bg-[#9B3C3C] p-10 md:p-16">
            <div className="relative mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Ready to automate your desktop?
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-base">
                Connect a device, describe your goal, and let the AI agent handle the rest.
                Full session logging and monitoring included.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  className="bg-white px-8 text-[#9B3C3C] shadow-lg hover:bg-[#FAF5F0]"
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
      <footer className="border-t border-[#E8DDD4] bg-white py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center">
            <img src="/logo.png" alt="Logo" className="h-8 w-30 rounded-lg object-contain" />
          </div>
          <p className="text-xs text-[#8A7060]">
            AI-powered desktop automation
          </p>
        </div>
      </footer>
    </div>
  );
}
