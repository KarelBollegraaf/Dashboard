import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import BalesPage from "./pages/BalesPage";
import BaleDetailPage from "./pages/BaleDetailPage";
import CycleTimesPage from "./pages/CycleTimesPage";
import PressurePage from "./pages/PressurePage";
import EventsPage from "./pages/EventsPage";
import RawInspectorPage from "./pages/RawInspectorPage";
import NotFound from "./pages/NotFound";
import QualityRulesPage from "./pages/QualityRulesPage";
import LoginPage from "./pages/LoginPage";
import UserManagementPage from "./pages/UserManagementPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<ProtectedRoute permission="dashboard.access" />}>
              <Route element={<AppLayout />}>
                <Route
                  path="/"
                  element={
                    <ProtectedRoute permission="overview.view">
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bales"
                  element={
                    <ProtectedRoute permission="bales.view">
                      <BalesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bales/:id"
                  element={
                    <ProtectedRoute permission="bales.view">
                      <BaleDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cycles"
                  element={
                    <ProtectedRoute permission="cycles.view">
                      <CycleTimesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pressure"
                  element={
                    <ProtectedRoute permission="pressure.view">
                      <PressurePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/events"
                  element={
                    <ProtectedRoute permission="events.view">
                      <EventsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/raw"
                  element={
                    <ProtectedRoute permission="raw.view">
                      <RawInspectorPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quality"
                  element={
                    <ProtectedRoute permission="quality.view">
                      <QualityRulesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute permission="users.view">
                      <UserManagementPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
