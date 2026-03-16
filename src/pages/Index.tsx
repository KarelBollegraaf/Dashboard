import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adaptOverview } from "@/lib/dashboardAdapter";
import { fetchCycles, fetchLatestBale, fetchOverviewWithRange, fetchPressure } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Package, Activity, Gauge, Zap, Thermometer, Droplets, Clock, Weight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: any;
  variant?: "default" | "primary" | "success";
}) {
  const variantStyles = {
    default: "border-card-border",
    primary: "border-primary/30 bg-primary/5",
    success: "border-status-success/30 bg-status-success/5",
  };

  return (
    <Card className={`p-4 border-2 ${variantStyles[variant]}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold text-foreground">
            {value} {unit && <span className="text-sm font-normal text-muted-foreground">{unit}</span>}
          </p>
        </div>
      </div>
    </Card>
  );
}

function nonZeroValues(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
}

const Index = () => {
  const [preset, setPreset] = useState("last7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const range = useMemo(() => {
    if (preset === "custom" && from && to) {
      return {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      };
    }

    const now = new Date();
    const start = new Date(now);

    if (preset === "last24h") start.setDate(now.getDate() - 1);
    else if (preset === "last7d") start.setDate(now.getDate() - 7);
    else if (preset === "last30d") start.setDate(now.getDate() - 30);
    else if (preset === "last365d") start.setDate(now.getDate() - 365);

    return {
      from: start.toISOString(),
      to: now.toISOString(),
    };
  }, [preset, from, to]);

  const overviewQuery = useQuery({
    queryKey: ["overview", preset, from, to, range.from, range.to],
    queryFn: () => fetchOverviewWithRange(range.from, range.to),
    refetchInterval: 10000,
    retry: 2,
  });

  const latestBaleQuery = useQuery({
    queryKey: ["latest-bale"],
    queryFn: () => fetchLatestBale(),
    refetchInterval: 5000,
    retry: 2,
  });

  const overview = adaptOverview(overviewQuery.data);
  const latestOnly = adaptOverview({ latest: latestBaleQuery.data }).latest;

    const latestCyclesQuery = useQuery({
    queryKey: ["latest-cycles", latestOnly?.rawId],
    queryFn: () => fetchCycles(latestOnly!.rawId),
    enabled: !!latestOnly?.rawId,
    refetchInterval: 5000,
    retry: 2,
  });

  const latestPressureQuery = useQuery({
    queryKey: ["latest-pressure", latestOnly?.rawId],
    queryFn: () => fetchPressure(latestOnly!.rawId),
    enabled: !!latestOnly?.rawId,
    refetchInterval: 5000,
    retry: 2,
  });

  const stats = overview.stats;
  const materials = overview.materials;
  const recent24h = overview.stats.recent24h;

  const latestCycles = Array.isArray(latestCyclesQuery.data?.cycles) ? latestCyclesQuery.data.cycles : [];
  const latestPressure = Array.isArray(latestPressureQuery.data?.pressure) ? latestPressureQuery.data.pressure : [];

  const totalRamStrokes = latestCycles
    .filter((item: any) => item?.label === "Ram Forward")
    .reduce((sum: number, item: any) => sum + (Array.isArray(item?.values) ? item.values.length : 0), 0);

  const maxHighPressure = latestPressure.reduce((max: number, item: any) => {
    const vals = nonZeroValues(item?.highPressure);
    return vals.length ? Math.max(max, Math.max(...vals)) : max;
  }, 0);

  const maxChannelPressure = latestPressure.reduce((max: number, item: any) => {
    const vals = nonZeroValues(item?.channelPressure);
    return vals.length ? Math.max(max, Math.max(...vals)) : max;
  }, 0);

  if (overviewQuery.isPending || latestBaleQuery.isPending) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (overviewQuery.error && latestBaleQuery.error) {
    return (
      <Card className="p-8 text-center border-2 border-status-error/30">
        <p className="text-status-error font-semibold mb-2">Failed to connect to API</p>
        <p className="text-sm text-muted-foreground">Check the backend and database connection.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {latestOnly?.customerNumber || "Baler"} — {latestOnly?.materialName || "No data"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Latest bale #{latestOnly?.baleNumber ?? 0} ·{" "}
              {latestOnly?.ts ? new Date(latestOnly.ts).toLocaleString() : "—"}
            </p>
          </div>
        </div>
      </div>

      <Card className="p-4 border-2 border-card-border">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Timeframe</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="bg-background border rounded px-3 py-2"
            >
              <option value="last24h">Last 24 hours</option>
              <option value="last7d">Last week</option>
              <option value="last30d">Last month</option>
              <option value="last365d">Last year</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {preset === "custom" && (
            <>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">From</label>
                <input
                  type="datetime-local"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="bg-background border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">To</label>
                <input
                  type="datetime-local"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="bg-background border rounded px-3 py-2"
                />
              </div>
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Bales" value={stats.totalBales} icon={Package} variant="primary" />
        <MetricCard title="Total Energy" value={stats.totalKwh.toFixed(2)} unit="kWh" icon={Zap} variant="success" />
        <MetricCard title="Total Time" value={(stats.sumTotalTime / 3600).toFixed(2)} unit="hrs" icon={Clock} variant="default" />
        <MetricCard title="Auto Time" value={(stats.sumAutoTime / 3600).toFixed(2)} unit="hrs" icon={Clock} variant="default" />
        <MetricCard title="Avg Weight" value={stats.avgWeight.toFixed(2)} unit="kg" icon={Weight} />
        <MetricCard title="Avg Bale Length" value={stats.avgBaleLength.toFixed(2)} unit="mm" icon={Gauge} />
        <MetricCard title="Avg Volume" value={stats.avgVolume.toFixed(2)} unit="m³" icon={Package} />
        <MetricCard
          title="Oil Temperature"
          value={(latestOnly?.oilTemperature ?? 0).toFixed(2)}
          unit="°C"
          icon={Thermometer}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {latestOnly && (
          <Card className="p-6 border-2 border-card-border">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Latest Bale Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Bale Number", latestOnly.baleNumber],
                ["Material", latestOnly.materialName],
                ["Recipe", latestOnly.recipeNumber],
                ["Shift", latestOnly.shiftNumber],
                ["Weight", `${latestOnly.weight.toFixed(2)} kg`],
                ["Volume", `${latestOnly.volume.toFixed(2)} m³`],
                ["Length", `${latestOnly.baleLength.toFixed(2)} mm`],
                ["kWh", latestOnly.kwhUsed.toFixed(2)],
                ["Total Time", `${latestOnly.totalTime.toFixed(2)} s`],
                ["Auto Time", `${latestOnly.autoTime.toFixed(2)} s`],
                ["Standby Time", `${latestOnly.standbyTime.toFixed(2)} s`],
                ["Empty Time", `${latestOnly.emptyTime.toFixed(2)} s`],
                ["Max High Pressure", maxHighPressure || "—"],
                ["Max Channel Pressure", maxChannelPressure || "—"],
                ["Total Ram Strokes", totalRamStrokes],
                ["Oil Temperature", `${(latestOnly.oilTemperature ?? 0).toFixed(2)} °C`],
                ["Oil Level", (latestOnly.oilLevel ?? 0).toFixed(2)],
                ["Knots V", latestOnly.knotsVertical],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-muted-foreground">{label}</p>
                  <p className="font-semibold text-foreground">{val}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 border-2 border-card-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">Material Breakdown - Time Frame</h3>

          <div className="space-y-4">
            {materials.map((m) => (
              <Card key={m.materialName} className="p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-medium text-foreground">{m.materialName}</p>
                  <span className="text-lg font-bold text-primary">{m.count}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Avg Weight", `${m.avgWeight.toFixed(2)} kg`],
                    ["Total Weight", `${Math.round(m.totalWeight)} kg`],

                    ["Avg Length", `${m.avgLength.toFixed(2)} mm`],
                    ["Total Length", `${(m.totalLength / 1000).toFixed(2)} m`],

                    ["Avg kWh", m.avgKwh.toFixed(2)],
                    ["Total kWh", m.totalKwh.toFixed(2)],

                    ["Avg Total Time", `${m.avgTotalTime.toFixed(2)} s`],
                    ["Total Time", `${(m.totalTotalTime / 3600).toFixed(2)} h`],

                    ["Avg Auto Time", `${m.avgAutoTime.toFixed(2)} s`],
                    ["Total Auto Time", `${(m.totalAutoTime / 3600).toFixed(2)} h`],

                    ["Avg Standby Time", `${m.avgStandbyTime.toFixed(2)} s`],
                    ["Total Standby Time", `${(m.totalStandbyTime / 3600).toFixed(2)} h`],

                    ["Avg Empty Time", `${m.avgEmptyTime.toFixed(2)} s`],
                    ["Total Empty Time", `${(m.totalEmptyTime / 3600).toFixed(2)} h`],

                    ["Avg Ram Strokes", m.avgRamForwards.toFixed(2)],
                    ["Total Ram Strokes", m.totalRamForwards.toFixed(0)],

                    ["Operators", m.operators || "—"],
                    ["Bales", m.count],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-muted-foreground">{label}</p>
                      <p className="font-semibold text-foreground">{val}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            {materials.length === 0 && (
              <p className="text-muted-foreground text-sm">No materials found</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6 border-2 border-card-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Time Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Total Time", (stats.sumTotalTime / 3600).toFixed(2), "hrs"],
            ["Auto Time", (stats.sumAutoTime / 3600).toFixed(2), "hrs"],
            ["Standby Time", (stats.sumStandbyTime / 3600).toFixed(2), "hrs"],
            ["Empty Time", (stats.sumEmptyTime / 3600).toFixed(2), "hrs"],
          ].map(([label, val, unit]) => (
            <div key={label} className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-foreground">
                {val} <span className="text-sm font-normal">{unit}</span>
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Index;