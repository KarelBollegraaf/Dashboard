import { NavLink, Outlet } from "react-router-dom";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/bales", label: "Bales" },
  { to: "/cycles", label: "Cycle Times" },
  { to: "/pressure", label: "Pressure" },
  { to: "/events", label: "Events" },
  { to: "/raw", label: "Raw Messages" },
];

export function AppLayout() {
  const { data } = useQuery({ queryKey: ["overview"], queryFn: fetchOverview, refetchInterval: 10000 });

  const isOnline = !!data?.latest;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-card-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <div className="w-3 h-3 rounded-full bg-primary opacity-70"></div>
                <div className="w-3 h-3 rounded-full bg-primary opacity-40"></div>
              </div>
              <h1 className="text-2xl font-bold text-secondary">Bollegraaf</h1>
            </div>
            <div className="h-8 w-px bg-border"></div>
            <h2 className="text-lg font-semibold text-foreground">Baler Statistics</h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <Badge className={cn(
                "px-3 py-1 font-semibold",
                isOnline ? "bg-status-running text-white" : "bg-status-idle text-white"
              )}>
                {isOnline ? "Online" : "Connecting..."}
              </Badge>
            </div>
            {data?.latest && (
              <div className="text-sm text-muted-foreground">
                Last bale: {new Date(data.latest.ts).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-card border-b border-card-border px-6">
        <div className="flex gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="p-6 max-w-[1800px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
