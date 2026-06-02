import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adaptOverview } from "@/lib/dashboardAdapter";
import {
  fetchBales,
  fetchCycles,
  fetchOverviewWithRange,
  fetchPressure,
} from "@/lib/api";
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
import {
  calculateBaleQuality,
  getQualityBadgeClass,
  summarizeBaleQuality,
} from "@/lib/baleQuality";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const MATERIAL_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#64748b",
  "#a855f7",
  "#22c55e",
  "#eab308",
  "#dc2626",
  "#0ea5e9",
  "#7c3aed",
  "#65a30d",
  "#ea580c",
  "#be123c",
];

function getMaterialColor(index: number) {
  return MATERIAL_COLORS[index % MATERIAL_COLORS.length];
}

function roundWhole(value: number) {
  return Math.round(Number(value || 0)).toString();
}

function formatWhole(value: number, unit?: string) {
  const rounded = Math.round(Number(value || 0));
  return unit ? `${rounded} ${unit}` : `${rounded}`;
}

function formatVolume(value: number) {
  const volumeM3 = Number(value || 0) / 1000;
  return `${volumeM3.toFixed(1)} m³`;
}

function formatSeconds(value: number) {
  return `${Math.round(Number(value || 0))} s`;
}

function formatHours(valueInSeconds: number) {
  return `${(Number(valueInSeconds || 0) / 3600).toFixed(2)} h`;
}

function formatRamAverage(value: number) {
  return Number(value || 0).toFixed(2);
}

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

type ComparisonRow = {
  label: string;
  latest: string | number;
  average?: string | number;
  total?: string | number;
};

function ComparisonTable({
  title,
  rows,
  showAverage = true,
  showTotal = true,
}: {
  title: string;
  rows: ComparisonRow[];
  showAverage?: boolean;
  showTotal?: boolean;
}) {
  return (
    <Card className="p-4 overflow-x-auto">
      <h4 className="text-base font-semibold mb-3">{title}</h4>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left py-3 px-3 font-semibold">Metric</th>
            <th className="text-left py-3 px-3 font-semibold">Latest Bale</th>
            {showAverage && (
              <th className="text-left py-3 px-3 font-semibold">
                Average in Timeframe
              </th>
            )}
            {showTotal && (
              <th className="text-left py-3 px-3 font-semibold">
                Total in Timeframe
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b last:border-b-0">
              <td className="py-3 px-3 text-muted-foreground">{row.label}</td>
              <td className="py-3 px-3 font-medium">{row.latest}</td>
              {showAverage && (
                <td className="py-3 px-3 font-medium">{row.average ?? "—"}</td>
              )}
              {showTotal && (
                <td className="py-3 px-3 font-medium">{row.total ?? "—"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function QualityBaleHoverList({
  bales,
  onOpenBale,
}: {
  bales: any[];
  onOpenBale: (id: number) => void;
}) {
  if (bales.length === 0) return null;

  return (
    <div className="absolute left-0 top-full z-50 mt-2 hidden w-[280px] rounded-xl border bg-background p-3 shadow-xl group-hover:block">
      <div className="mb-2 text-xs font-semibold text-foreground">
        Bales to check
      </div>

      <div className="max-h-64 space-y-1 overflow-auto">
        {bales.slice(0, 20).map((bale) => (
          <button
            key={bale.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenBale(bale.id);
            }}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
          >
            <span className="font-medium">#{bale.baleNumber}</span>
            <span className="text-muted-foreground">{bale.materialName}</span>
          </button>
        ))}
      </div>

      {bales.length > 20 && (
        <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          Showing first 20 of {bales.length}
        </div>
      )}
    </div>
  );
}

const Index = () => {
  const navigate = useNavigate();
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

  const qualityBalesQuery = useQuery({
    queryKey: [
      "quality-bales",
      range.from,
      range.to,
      selectedMaterials,
      selectedRecipes,
    ],
    queryFn: async () => {
      const firstPage = await fetchBales({
        page: 1,
        limit: 100,
        sort: "ts",
        order: "DESC",
        from: range.from,
        to: range.to,
        material:
          selectedMaterials.length === 1 ? selectedMaterials[0] : undefined,
      });

      const allBales = [...(firstPage.data ?? [])];
      const totalPages = firstPage.pagination?.totalPages ?? 1;

      for (let page = 2; page <= totalPages; page += 1) {
        const nextPage = await fetchBales({
          page,
          limit: 100,
          sort: "ts",
          order: "DESC",
          from: range.from,
          to: range.to,
          material:
            selectedMaterials.length === 1 ? selectedMaterials[0] : undefined,
        });

        allBales.push(...(nextPage.data ?? []));
      }

      return allBales;
    },
    refetchInterval: 10000,
    retry: 1,
  });

  const qualityBalesRaw = qualityBalesQuery.data ?? [];

  const qualityBales = qualityBalesRaw.filter((b: any) => {
    const materialName = b.material_name ?? b.materialName;
    const recipeNumber = Number(b.recipe_number ?? b.recipeNumber ?? 0);

    const materialOk =
      selectedMaterials.length === 0 || selectedMaterials.includes(materialName);

    const recipeOk =
      selectedRecipes.length === 0 || selectedRecipes.includes(recipeNumber);

    return materialOk && recipeOk;
  });

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

  const latestQuality = latestOnly
    ? calculateBaleQuality({
        materialName: latestOnly.materialName,
        baleNumber: latestOnly.baleNumber,
        weight: latestOnly.weight,
        volume: latestOnly.volume,
        baleLength: latestOnly.baleLength,
        totalTime: latestOnly.totalTime,
        autoTime: latestOnly.autoTime,
        kwhUsed: latestOnly.kwhUsed,
        ramStrokes: totalRamStrokes,
        maxHighPressure,
        maxChannelPressure,
      })
    : null;

  const qualitySummary = summarizeBaleQuality(
    qualityBales.map((b: any) => ({
      materialName: b.material_name ?? b.materialName,
      baleNumber: b.bale_number ?? b.baleNumber,
      weight: b.weight,
      volume: b.volume,
      baleLength: b.bale_length ?? b.baleLength,
      totalTime: b.total_time ?? b.totalTime,
      autoTime: b.auto_time ?? b.autoTime,
      kwhUsed: b.kwh_used ?? b.kwhUsed,
    }))
  );

const qualityTotal = qualityBales.length;

const qualityRows = qualityBales.map((b: any) => {
  const quality = calculateBaleQuality({
    materialName: b.material_name ?? b.materialName,
    baleNumber: b.bale_number ?? b.baleNumber,
    weight: b.weight,
    volume: b.volume,
    baleLength: b.bale_length ?? b.baleLength,
    totalTime: b.total_time ?? b.totalTime,
    autoTime: b.auto_time ?? b.autoTime,
    kwhUsed: b.kwh_used ?? b.kwhUsed,
  });

  return {
    id: b.id,
    baleNumber: b.bale_number ?? b.baleNumber,
    materialName: b.material_name ?? b.materialName,
    ts: b.ts,
    quality,
  };
});

const warningBales = qualityRows.filter(
  (b: any) => b.quality.status === "WARNING"
);

const unknownBales = qualityRows.filter(
  (b: any) => b.quality.status === "UNKNOWN"
);

  const qualityGoodPercent =
    qualityTotal > 0
      ? Math.round(((qualitySummary.GOOD + qualitySummary.OK) / qualityTotal) * 100)
      : 0;

  const timelineRows = overview.timeline?.rows ?? [];
  const timelineMap = new Map<string, any>();

  const timelineMaterials = Array.from(
    new Set(
      timelineRows
        .map((row: any) => row.materialName || "Unknown")
        .filter(Boolean)
    )
  );

  for (const row of timelineRows) {
    const bucket = row.bucket;
    const material = row.materialName || "Unknown";
    const count = Number(row.baleCount ?? 0);

    if (!timelineMap.has(bucket)) {
      timelineMap.set(bucket, {
        bucket,
        total: 0,
        totalTimeHours: 0,
        autoTimeHours: 0,
        standbyTimeHours: 0,
        emptyTimeHours: 0,
      });
    }

    const item = timelineMap.get(bucket);
    item.total += count;
    item[material] = count;
    item.totalTimeHours += Number(row.sumTotalTime ?? 0) / 3600;
    item.autoTimeHours += Number(row.sumAutoTime ?? 0) / 3600;
    item.standbyTimeHours += Number(row.sumStandbyTime ?? 0) / 3600;
    item.emptyTimeHours += Number(row.sumEmptyTime ?? 0) / 3600;
  }

  const timelineData = Array.from(timelineMap.values());

  const materialSummary =
    latestOnly && materials.length > 0
      ? materials.find((m: any) => m.materialName === latestOnly.materialName) ??
        materials[0]
      : materials[0];

  const summaryCards =
    latestOnly && materialSummary
      ? [
          {
            label: "Latest Bale",
            value: `#${latestOnly.baleNumber}`,
            quality: latestQuality?.status ?? "UNKNOWN",
          },
          { label: "Material", value: latestOnly.materialName },
          { label: "Bales Selected", value: `${materialSummary.count}` },
          { label: "Recipe", value: `${latestOnly.recipeNumber}` },
        ]
      : [];

  const productionRows: ComparisonRow[] =
    latestOnly && materialSummary
      ? [
          {
            label: "Weight",
            latest: formatWhole(latestOnly.weight, "kg"),
            average: formatWhole(materialSummary.avgWeight, "kg"),
            total: formatWhole(materialSummary.totalWeight, "kg"),
          },
          {
            label: "Volume",
            latest: formatVolume(latestOnly.volume),
            average: formatVolume(materialSummary.avgVolume),
            total: formatVolume(materialSummary.totalVolume),
          },
          {
            label: "Length",
            latest: formatWhole(latestOnly.baleLength, "mm"),
            average: formatWhole(materialSummary.avgLength, "mm"),
            total: formatWhole(materialSummary.totalLength / 1000, "m"),
          },
          {
            label: "kWh",
            latest: formatWhole(latestOnly.kwhUsed, "kWh"),
            average: formatWhole(materialSummary.avgKwh, "kWh"),
            total: formatWhole(materialSummary.totalKwh, "kWh"),
          },
          {
            label: "Ram Strokes",
            latest: roundWhole(totalRamStrokes),
            average: formatRamAverage(materialSummary.avgRamForwards),
            total: roundWhole(materialSummary.totalRamForwards),
          },
        ]
      : [];

  const timeRows: ComparisonRow[] =
    latestOnly && materialSummary
      ? [
          {
            label: "Total Time",
            latest: formatSeconds(latestOnly.totalTime),
            average: formatSeconds(materialSummary.avgTotalTime),
            total: formatHours(materialSummary.totalTotalTime),
          },
          {
            label: "Auto Time",
            latest: formatSeconds(latestOnly.autoTime),
            average: formatSeconds(materialSummary.avgAutoTime),
            total: formatHours(materialSummary.totalAutoTime),
          },
          {
            label: "Standby Time",
            latest: formatSeconds(latestOnly.standbyTime),
            average: formatSeconds(materialSummary.avgStandbyTime),
            total: formatHours(materialSummary.totalStandbyTime),
          },
          {
            label: "Empty Time",
            latest: formatSeconds(latestOnly.emptyTime),
            average: formatSeconds(materialSummary.avgEmptyTime),
            total: formatHours(materialSummary.totalEmptyTime),
          },
        ]
      : [];

  const machineRows: ComparisonRow[] =
    latestOnly && materialSummary
      ? [
          {
            label: "Max High Pressure",
            latest: maxHighPressure ? roundWhole(maxHighPressure) : "—",
            average: formatWhole(materialSummary.avgHighPressure),
          },
          {
            label: "Max Channel Pressure",
            latest: maxChannelPressure ? roundWhole(maxChannelPressure) : "—",
            average: formatWhole(materialSummary.avgChannelPressure),
          },
          {
            label: "Oil Temperature",
            latest: `${roundWhole(latestOnly.oilTemperature ?? 0)} °C`,
            average: `${roundWhole(materialSummary.avgOilTemperature)} °C`,
          },
          {
            label: "Oil Level",
            latest: roundWhole(latestOnly.oilLevel ?? 0),
            average: roundWhole(materialSummary.avgOilLevel),
          },
          {
            label: "Knots V",
            latest: roundWhole(latestOnly.knotsVertical ?? 0),
            average: roundWhole(materialSummary.avgKnotsVertical),
          },
          {
            label: "Operators",
            latest: "—",
            average: materialSummary.operators || "—",
          },
        ]
      : [];

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
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground mt-1">
          <span>
            Latest bale #{latestOnly?.baleNumber ?? 0} ·{" "}
            {latestOnly?.ts ? new Date(latestOnly.ts).toLocaleString() : "—"}
          </span>
          {latestQuality && <QualityBadge status={latestQuality.status} />}
          {latestQuality && (
            <span className="text-xs">Score {latestQuality.score}/100</span>
          )}
        </div>
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
          value={stats.avgWeight.toFixed(0)}
          unit="kg"
          icon={Weight}
        />
        <MetricCard
          title="Total kWh"
          value={stats.totalKwh.toFixed(0)}
          unit="kWh"
          icon={Zap}
        />
      </div>

      <Card className="p-5 border-2 border-card-border">
        <div className="grid gap-5 xl:grid-cols-[260px_1fr_260px] items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-foreground">Bale Quality</h3>
              {latestQuality && <QualityBadge status={latestQuality.status} />}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              Weight, length, density and total time.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3">
              <div className="text-xs font-semibold text-green-700">GOOD</div>
              <div className="mt-1 text-2xl font-bold text-green-950">
                {qualitySummary.GOOD}
              </div>
            </div>

            <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3">
              <div className="text-xs font-semibold text-blue-700">OK</div>
              <div className="mt-1 text-2xl font-bold text-blue-950">
                {qualitySummary.OK}
              </div>
            </div>

            <div className="group relative rounded-lg border border-orange-300 bg-orange-50 px-4 py-3">
              <div className="text-xs font-semibold text-orange-700">WARNING</div>
              <div className="mt-1 text-2xl font-bold text-orange-950">
                {qualitySummary.WARNING}
              </div>

              {warningBales.length > 0 && (
                <div className="mt-1 text-xs text-orange-700">
                  Hover / click bale
                </div>
              )}

              <QualityBaleHoverList
                bales={warningBales}
                onOpenBale={(id) => navigate(`/bales/${id}`)}
              />
            </div>

            <div className="group relative rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold text-slate-600">UNKNOWN</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {qualitySummary.UNKNOWN}
              </div>

              {unknownBales.length > 0 && (
                <div className="mt-1 text-xs text-slate-600">
                  Hover / click bale
                </div>
              )}

              <QualityBaleHoverList
                bales={unknownBales}
                onOpenBale={(id) => navigate(`/bales/${id}`)}
              />
            </div>

          <div className="rounded-lg border bg-muted/20 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">GOOD + OK</div>
                <div className="text-3xl font-bold text-foreground">
                  {qualityGoodPercent}%
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {qualityTotal} scored / {stats.totalBales} selected
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-muted-foreground">Latest</div>
                <div className="font-bold">#{latestOnly?.baleNumber ?? "—"}</div>
                {latestQuality && (
                  <div className="mt-1">
                    <QualityBadge status={latestQuality.status} />
                  </div>
                )}
              </div>
            </div>

            {latestQuality && latestQuality.reasons.length > 0 && (
              <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
                {latestQuality.reasons.join(", ")}
              </div>
            )}
          </div>
        </div>
      </Card>

      {latestOnly && materialSummary && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Bale Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Latest bale compared with the selected timeframe.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {summaryCards.map((card) => (
              <Card key={card.label} className="p-4">
                <div className="text-sm text-muted-foreground">{card.label}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="text-2xl font-bold">{card.value}</div>
                  {"quality" in card && <QualityBadge status={String(card.quality)} />}
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4">
            <ComparisonTable title="Production" rows={productionRows} />
            <ComparisonTable title="Time" rows={timeRows} />
            <ComparisonTable
              title="Machine"
              rows={machineRows}
              showAverage={true}
              showTotal={false}
            />
          </div>
        </div>
      )}

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
          {timelineData.length > 0 ? (
            <Card className="p-4">
              <div className="mb-4">
                <div className="text-lg font-semibold">
                  Bales per Material and Time per {overview.timeline?.bucket ?? "day"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Bars = bales per material, lines = hours
                </div>
              </div>

              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" />

                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      label={{ value: "Bales", angle: -90, position: "insideLeft" }}
                    />

                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: "Hours", angle: 90, position: "insideRight" }}
                    />

                    <Tooltip
                      formatter={(value: any, name: any) => {
                        const numberValue = Number(value);

                        if (!Number.isFinite(numberValue)) {
                          return [value, name];
                        }

                        const isMaterial = timelineMaterials.includes(String(name));

                        if (isMaterial) {
                          return [numberValue.toFixed(0), name];
                        }

                        return [numberValue.toFixed(2), name];
                      }}
                      labelFormatter={(label) => `Time: ${label}`}
                    />

                    <Legend />

                    {timelineMaterials.map((material, index) => (
                      <Bar
                        key={material}
                        yAxisId="left"
                        dataKey={material}
                        name={material}
                        stackId="bales"
                        fill={getMaterialColor(index)}
                        radius={[6, 6, 0, 0]}
                      />
                    ))}

                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="totalTimeHours"
                      name="Total Time"
                      stroke="#1d4ed8"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#1d4ed8", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />

                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="autoTimeHours"
                      name="Auto Time"
                      stroke="#15803d"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#15803d", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />

                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="standbyTimeHours"
                      name="Standby Time"
                      stroke="#d97706"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#d97706", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />

                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="emptyTimeHours"
                      name="Empty Time"
                      stroke="#dc2626"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#dc2626", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : (
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