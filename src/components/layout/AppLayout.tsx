import { NavLink, Outlet } from "react-router-dom";
import { Activity, LogOut, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_NAV_ITEMS } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthProvider";
import { fetchOverview } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatTimestampTime(value?: string | null) {
  if (!value) return "—";

  return String(value)
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "")
    .replace(/Z$/, "")
    .slice(11, 19);
}

export function AppLayout() {
  const { currentUser, hasPermission, logout } = useAuth();
  const canViewOverview = hasPermission("overview.view");

  const { data } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
    refetchInterval: 10000,
    enabled: canViewOverview,
  });

  const isOnline = canViewOverview && !!data?.latest;
  const visibleNavItems = DASHBOARD_NAV_ITEMS.filter((item) =>
    hasPermission(item.permission)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-card-border px-6 py-4">
        <div className="flex items-center justify-between gap-6">
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

            <h2 className="text-lg font-semibold text-foreground">
              Baler Statistics
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <Badge
                className={cn(
                  "px-3 py-1 font-semibold",
                  isOnline
                    ? "bg-status-running text-white"
                    : "bg-status-idle text-white"
                )}
              >
                {isOnline ? "Online" : "Limited"}
              </Badge>
            </div>

            {data?.latest && (
              <div className="text-sm text-muted-foreground">
                Last bale: {formatTimestampTime(data.latest.ts)}
              </div>
            )}

            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle className="h-5 w-5" />
              <span>{currentUser?.email}</span>
            </div>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-card border-b border-card-border px-6">
        <div className="flex gap-1 overflow-x-auto">
          {visibleNavItems.map((item) => (
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

      <main className="p-6 max-w-[1800px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
