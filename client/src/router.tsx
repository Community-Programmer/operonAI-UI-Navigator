import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard-layout";
import { LandingPage } from "@/pages/landing";
import { LoginPage } from "@/pages/login";
import { SignupPage } from "@/pages/signup";
import { DevicesPage } from "@/pages/devices";
import { SystemsPage } from "@/pages/systems";
import { NavigatePage } from "@/pages/navigate";
import { VoicePage } from "@/pages/voice";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/app",
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Navigate to="/app/systems" replace /> },
      { path: "systems", element: <SystemsPage /> },
      { path: "devices", element: <DevicesPage /> },
      { path: "navigate/:deviceId", element: <NavigatePage /> },
      { path: "voice/:deviceId", element: <VoicePage /> },
    ],
  },
  { path: "/devices", element: <Navigate to="/app/devices" replace /> },
]);
