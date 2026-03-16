import { adaptOverview } from "@/lib/dashboardAdapter";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import BalesPage from "./pages/BalesPage";
import BaleDetailPage from "./pages/BaleDetailPage";
import CycleTimesPage from "./pages/CycleTimesPage";
import PressurePage from "./pages/PressurePage";
import EventsPage from "./pages/EventsPage";
import RawInspectorPage from "./pages/RawInspectorPage";
import NotFound from "./pages/NotFound";

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
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/bales" element={<BalesPage />} />
            <Route path="/bales/:id" element={<BaleDetailPage />} />
            <Route path="/cycles" element={<CycleTimesPage />} />
            <Route path="/pressure" element={<PressurePage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/raw" element={<RawInspectorPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
