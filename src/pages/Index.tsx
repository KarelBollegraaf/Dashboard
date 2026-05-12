import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adaptOverview } from "@/lib/dashboardAdapter";
import { fetchCycles, fetchOverviewWithRange, fetchPressure } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Package,
  Activity,
  Gauge,
  Zap,
  Thermometer,
  Droplets,
  Clock,
  Weight,
} from "lucide-react";
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
    <Card className={`p-6 border ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-2">
            {value} {unit && <span className="text-lg font-normal">{unit}</span>}
          </p>
        </div>
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
    </Card>
  );
}

function nonZeroValues(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
}

function toggleStringValue(
  value: string,
  setList: React.Dispatch<React.SetStateAction<string[]>>
) {
  setList((prev) =>
    prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
  );
}

function toggleNumberValue(
  value: number,
  setList: React.Dispatch<React.SetStateAction<number[]>>
) {
  setList((prev) =>
    prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
  );
}

const Index = () => {
  const [preset, setPreset] = useState("last7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<number[]>([]);
  const [selectedBaleId, setSelectedBaleId] = useState<number | null>(null);

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
    queryKey: [
      "overview",
      preset,
      from,
      to,
      range.from,
      range.to,
      selectedMaterials,
      selectedRecipes,
    ],
    queryFn: () =>
      fetchOverviewWithRange({
        from: range.from,
        to: range.to,
        materials: selectedMaterials,
        recipes: selectedRecipes,
      }),
    refetchInterval: 10000,
    retry: 2,
  });

  const overview = adaptOverview(overviewQuery.data);
  const stats = overview.stats;
  const materials = overview.materials;
  const recent24h = overview.stats.recent24h;
  const baleOptions = overview.baleOptions ?? [];

  const latestOnly =
    baleOptions.find((b: any) => b.id === selectedBaleId) ??
    baleOptions[0] ??
    overview.latest;

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

  const latestCycles = Array.isArray(latestCyclesQuery.data?.cycles)
    ? latestCyclesQuery.data.cycles
    : [];

  const latestPressure = Array.isArray(latestPressureQuery.data?.pressure)
    ? latestPressureQuery.data.pressure
    : [];

  const totalRamStrokes = latestCycles
    .filter((item: any) => item?.label === "Ram Forward")
    .reduce(
      (sum: number, item: any) =>
        sum + (Array.isArray(item?.values) ? item.values.length : 0),
      0
    );

  const maxHighPressure = latestPressure.reduce((max: number, item: any) => {
    const vals = nonZeroValues(item?.highPressure);
    return vals.length ? Math.max(max, Math.max(...vals)) : max;
  }, 0);

  const maxChannelPressure = latestPressure.reduce((max: number, item: any) => {
    const vals = nonZeroValues(item?.channelPressure);
    return vals.length ? Math.max(max, Math.max(...vals)) : max;
  }, 0);

  const timelineRows = overview.timeline?.rows ?? [];
  const timelineMap = new Map<string, any>();

  for (const row of timelineRows) {
    const bucket = row.bucket;
    const material = row.materialName || "Unknown";
    const count = Number(row.baleCount ?? 0);

    if (!timelineMap.has(bucket)) {
      timelineMap.set(bucket, { bucket, total: 0 });
    }

    const item = timelineMap.get(bucket);
    item.total += count;
    item[material] = count;
  }

  const timelineData = Array.from(timelineMap.values());

  if (overviewQuery.isPending) {
    return (
      <div className="space-y-6 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (overviewQuery.error) {
    return (
      <div className="p-6">
        <Card className="p-6 border-destructive">
          <h2 className="text-xl font-semibold text-destructive mb-2">
            Failed to connect to API
          </h2>
          <p className="text-muted-foreground">
            Check the backend and database connection.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">
          {latestOnly?.customerNumber || "Baler"} —{" "}
          {latestOnly?.materialName || "No data"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Latest bale #{latestOnly?.baleNumber ?? 0} ·{" "}
          {latestOnly?.ts ? new Date(latestOnly.ts).toLocaleString() : "—"}
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Timeframe</label>
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
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">From</label>
                <input
                  type="datetime-local"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="bg-background border rounded px-3 py-2"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">To</label>
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

      <Card className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm font-medium mb-2">Materials</div>
            <div className="max-h-40 overflow-auto space-y-2 border rounded p-2">
              {(overview.filters?.materials ?? []).map((material: string) => (
                <label key={material} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedMaterials.includes(material)}
                    onChange={() =>
                      toggleStringValue(material, setSelectedMaterials)
                    }
                  />
                  <span>{material}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Leave empty = all materials
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Recipes</div>
            <div className="max-h-40 overflow-auto space-y-2 border rounded p-2">
              {(overview.filters?.recipes ?? []).map((recipe: number) => (
                <label key={recipe} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedRecipes.includes(recipe)}
                    onChange={() =>
                      toggleNumberValue(recipe, setSelectedRecipes)
                    }
                  />
                  <span>Recipe {recipe}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Leave empty = all recipes
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Latest Bale Details</div>
            <select
              value={selectedBaleId ?? ""}
              onChange={(e) =>
                setSelectedBaleId(e.target.value ? Number(e.target.value) : null)
              }
              className="bg-background border rounded px-3 py-2 w-full"
            >
              <option value="">Newest bale in current filters</option>
              {baleOptions.map((b: any) => (
                <option key={b.id} value={b.id}>
                  #{b.baleNumber} - {b.materialName} - Recipe {b.recipeNumber}
                </option>
              ))}
            </select>
            <div className="text-xs text-muted-foreground mt-2">
              Default stays on the newest filtered bale
            </div>
          </div>

          <div className="flex items-end">
            <button
              className="bg-background border rounded px-3 py-2 w-full"
              onClick={() => {
                setSelectedMaterials([]);
                setSelectedRecipes([]);
                setSelectedBaleId(null);
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Bales"
          value={stats.totalBales}
          icon={Package}
          variant="primary"
        />
        <MetricCard
          title="Bales (24h)"
          value={recent24h}
          icon={Activity}
          variant="success"
        />
        <MetricCard
          title="Avg Weight"
          value={stats.avgWeight.toFixed(1)}
          unit="kg"
          icon={Weight}
        />
        <MetricCard
          title="Total kWh"
          value={stats.totalKwh.toFixed(1)}
          unit="kWh"
          icon={Zap}
        />
      </div>

      {latestOnly && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Latest Bale Details</h3>
          <Card className="p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                <div key={String(label)} className="border rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold mt-1">{val}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Material Breakdown - Time Frame</h3>

        {materials.map((m: any) => (
          <Card key={m.materialName} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">{m.materialName}</h4>
              <span className="text-sm text-muted-foreground">{m.count} bales</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                <div key={String(label)} className="border rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold mt-1">{val}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}

        {materials.length === 0 && (
          <Card className="p-4">
            <div className="text-muted-foreground">No materials found</div>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Time Summary</h3>

        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Total bales</div>
              <div className="text-2xl font-bold">{stats.totalBales}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Bucket type</div>
              <div className="text-2xl font-bold capitalize">
                {overview.timeline?.bucket ?? "day"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Selected materials</div>
              <div className="text-sm font-medium">
                {selectedMaterials.length > 0
                  ? selectedMaterials.join(", ")
                  : "All"}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          {timelineData.map((row) => (
            <Card key={row.bucket} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">{row.bucket}</div>
                <div className="text-sm text-muted-foreground">
                  {row.total} bale{row.total === 1 ? "" : "s"}
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(row)
                  .filter(([key]) => key !== "bucket" && key !== "total")
                  .map(([material, count]) => (
                    <div
                      key={material}
                      className="flex items-center justify-between text-sm border rounded px-3 py-2"
                    >
                      <span>{material}</span>
                      <span>{String(count)}</span>
                    </div>
                  ))}
              </div>
            </Card>
          ))}

          {timelineData.length === 0 && (
            <Card className="p-4 text-sm text-muted-foreground">
              No bale timeline data found for the selected filters.
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Total Time"
          value={(stats.sumTotalTime / 3600).toFixed(2)}
          unit="hrs"
          icon={Clock}
        />
        <MetricCard
          title="Auto Time"
          value={(stats.sumAutoTime / 3600).toFixed(2)}
          unit="hrs"
          icon={Gauge}
        />
        <MetricCard
          title="Standby Time"
          value={(stats.sumStandbyTime / 3600).toFixed(2)}
          unit="hrs"
          icon={Thermometer}
        />
        <MetricCard
          title="Empty Time"
          value={(stats.sumEmptyTime / 3600).toFixed(2)}
          unit="hrs"
          icon={Droplets}
        />
      </div>
    </div>
  );
};

export default Index;