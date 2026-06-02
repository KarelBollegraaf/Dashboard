import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchBaleDetail, fetchCycles, fetchPressure } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const HIGH_PRESSURE_COLOR = "#ef4444";
const CHANNEL_PRESSURE_COLOR = "#0ea5e9";
const CYCLE_COLOR = "#f97316";
const VALVE_COLOR = "#f97316";

const MOTION_ORDER = [
  "Ram Forward",
  "Ram Reverse",
  "Ram Backward",
  "Ram Backwards",
  "Flap Forward",
  "Flap Reverse",
  "Flap Backward",
  "Flap Backwards",
];

type MotionSummaryItem = {
  label: string;
  strikes: number;
  totalSeconds: number;
  maxChannelPressure: number;
  maxHighPressure: number;
};

type NumberStats = {
  min: number;
  max: number;
  avg: number;
  count: number;
};

type CycleGroup = {
  label: string;
  values: number[];
  stats: NumberStats;
};

type PressureGroup = {
  label: string;
  highPressure: number[];
  channelPressure: number[];
  highPressureStats: NumberStats;
  channelPressureStats: NumberStats;
};

function getMotionOrder(label: string) {
  const index = MOTION_ORDER.findIndex(
    (item) => item.toLowerCase() === String(label).toLowerCase()
  );

  return index === -1 ? 999 : index;
}

function sortMotionLabels(a: { label: string }, b: { label: string }) {
  const orderA = getMotionOrder(a.label);
  const orderB = getMotionOrder(b.label);

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return a.label.localeCompare(b.label);
}

function formatWhole(value: number | null | undefined, unit?: string) {
  const rounded = Math.round(Number(value || 0));
  return unit ? `${rounded} ${unit}` : `${rounded}`;
}

function formatVolume(value: number | null | undefined) {
  const volumeM3 = Number(value || 0) / 1000;
  return `${volumeM3.toFixed(1)} m³`;
}

function formatSeconds(value: number | null | undefined) {
  return `${Math.round(Number(value || 0))} s`;
}

function normalizePositiveNumbers(values: unknown): number[] {
  if (!Array.isArray(values)) return [];

  return values
    .map(Number)
    .filter((v: number) => Number.isFinite(v) && v > 0);
}

function getStats(values: number[]): NumberStats {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      count: 0,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: total / values.length,
    count: values.length,
  };
}

function buildGroupedCycles(cyclesData: any): CycleGroup[] {
  const cycles = Array.isArray(cyclesData?.cycles) ? cyclesData.cycles : [];
  const grouped = new Map<string, number[]>();

  for (const cycle of cycles) {
    const label = cycle?.label ?? "Unknown";
    const values = normalizePositiveNumbers(cycle?.values);

    if (!grouped.has(label)) {
      grouped.set(label, []);
    }

    grouped.get(label)!.push(...values);
  }

  return Array.from(grouped.entries())
    .map(([label, values]) => ({
      label,
      values,
      stats: getStats(values),
    }))
    .filter((group) => group.values.length > 0)
    .sort(sortMotionLabels);
}

function buildGroupedPressure(pressureData: any): PressureGroup[] {
  const pressure = Array.isArray(pressureData?.pressure)
    ? pressureData.pressure
    : [];

  const grouped = new Map<
    string,
    {
      highPressure: number[];
      channelPressure: number[];
    }
  >();

  for (const item of pressure) {
    const label = item?.label ?? "Unknown";
    const highPressure = normalizePositiveNumbers(item?.highPressure);
    const channelPressure = normalizePositiveNumbers(item?.channelPressure);

    if (!grouped.has(label)) {
      grouped.set(label, {
        highPressure: [],
        channelPressure: [],
      });
    }

    const group = grouped.get(label)!;
    group.highPressure.push(...highPressure);
    group.channelPressure.push(...channelPressure);
  }

  return Array.from(grouped.entries())
    .map(([label, values]) => ({
      label,
      highPressure: values.highPressure,
      channelPressure: values.channelPressure,
      highPressureStats: getStats(values.highPressure),
      channelPressureStats: getStats(values.channelPressure),
    }))
    .filter(
      (group) =>
        group.highPressure.length > 0 || group.channelPressure.length > 0
    )
    .sort(sortMotionLabels);
}

function buildMotionSummary(
  groupedCycles: CycleGroup[],
  groupedPressure: PressureGroup[]
): MotionSummaryItem[] {
  const labels = new Set<string>();

  for (const cycle of groupedCycles) {
    labels.add(cycle.label);
  }

  for (const pressure of groupedPressure) {
    labels.add(pressure.label);
  }

  return Array.from(labels)
    .map((label) => {
      const cycle = groupedCycles.find((item) => item.label === label);
      const pressure = groupedPressure.find((item) => item.label === label);

      return {
        label,
        strikes: cycle?.values.length ?? 0,
        totalSeconds:
          (cycle?.values.reduce((sum, value) => sum + value, 0) ?? 0) / 1000,
        maxChannelPressure: pressure?.channelPressureStats.max ?? 0,
        maxHighPressure: pressure?.highPressureStats.max ?? 0,
      };
    })
    .filter(
      (row) =>
        row.strikes > 0 ||
        row.totalSeconds > 0 ||
        row.maxChannelPressure > 0 ||
        row.maxHighPressure > 0
    )
    .sort(sortMotionLabels);
}

export default function BaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const baleId = Number(id);

  const {
    data: bale,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bale", baleId],
    queryFn: () => fetchBaleDetail(baleId),
    enabled: !!baleId,
  });

  const { data: cyclesData } = useQuery({
    queryKey: ["cycles", bale?.raw_id],
    queryFn: () => fetchCycles(bale!.raw_id),
    enabled: !!bale?.raw_id,
  });

  const { data: pressureData } = useQuery({
    queryKey: ["pressure", bale?.raw_id],
    queryFn: () => fetchPressure(bale!.raw_id),
    enabled: !!bale?.raw_id,
  });

  if (error) return <div>Failed to load bale</div>;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!bale) return <div>Bale not found</div>;

  const groupedCycles = buildGroupedCycles(cyclesData);
  const groupedPressure = buildGroupedPressure(pressureData);
  const motionSummary = buildMotionSummary(groupedCycles, groupedPressure);

  const valveData = [
    { name: "LP", value: bale.valve_lp },
    { name: "HP", value: bale.valve_hp },
    { name: "KO1", value: bale.valve_ko1 },
    { name: "KO2", value: bale.valve_ko2 },
    { name: "KD1", value: bale.valve_kd1 },
    { name: "KD2", value: bale.valve_kd2 },
    { name: "RP1", value: bale.valve_rp1 },
    { name: "RP2", value: bale.valve_rp2 },
    { name: "RR1", value: bale.valve_rr1 },
    { name: "RR2", value: bale.valve_rr2 },
    { name: "CH", value: bale.valve_ch },
    { name: "MES", value: bale.valve_mes },
  ].filter((v) => v.value != null);

  const totalRamStrokes = motionSummary
    .filter((item) => item.label === "Ram Forward")
    .reduce((sum, item) => sum + item.strikes, 0);

  const maxHighPressure = motionSummary.reduce(
    (max, item) => Math.max(max, item.maxHighPressure),
    0
  );

  const maxChannelPressure = motionSummary.reduce(
    (max, item) => Math.max(max, item.maxChannelPressure),
    0
  );

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate("/bales")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Bales
      </Button>

      <Card className="p-6 border-2 border-card-border">
        <h2 className="text-2xl font-bold text-foreground">
          Bale #{bale.bale_number} — {bale.material_name}
        </h2>

        <p className="text-sm text-muted-foreground mt-1">
          {new Date(bale.ts).toLocaleString()}
        </p>

        <Tabs defaultValue="summary" className="mt-6">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="valves">Valves</TabsTrigger>
            <TabsTrigger value="cycles">Cycles</TabsTrigger>
            <TabsTrigger value="pressure">Pressure</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ["Recipe #", formatWhole(bale.recipe_number)],
                ["Shift", formatWhole(bale.shift_number)],
                [
                  "Max High Pressure",
                  maxHighPressure ? formatWhole(maxHighPressure) : "—",
                ],
                [
                  "Max Channel Pressure",
                  maxChannelPressure ? formatWhole(maxChannelPressure) : "—",
                ],
                ["Weight", formatWhole(bale.weight, "kg")],
                ["Volume", formatVolume(bale.volume)],
                ["Bale Length", formatWhole(bale.bale_length, "mm")],
                ["kWh Used", formatWhole(bale.kwh_used, "kWh")],
                ["Total Time", formatSeconds(bale.total_time)],
                ["Auto Time", formatSeconds(bale.auto_time)],
                ["Standby Time", formatSeconds(bale.standby_time)],
                ["Empty Time", formatSeconds(bale.empty_time)],
                [
                  "Oil Temperature",
                  `${formatWhole(bale.oil_temperature)} °C`,
                ],
                ["Oil Level", formatWhole(bale.oil_level)],
                ["Total Ram Strokes", formatWhole(totalRamStrokes)],
                ["Wires H", formatWhole(bale.wires_horizontal)],
                ["Knots V", formatWhole(bale.knots_vertical)],
                ["Knots H", formatWhole(bale.knots_horizontal)],
              ].map(([label, val]) => (
                <Card key={label as string} className="p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {val ?? "—"}
                  </p>
                </Card>
              ))}
            </div>

            <Card className="p-6 bg-muted/20">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Movement Summary
              </h3>

              {motionSummary.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {motionSummary.map((item) => (
                    <Card key={item.label} className="p-4 bg-background">
                      <p className="font-medium text-foreground mb-2">
                        {item.label}
                      </p>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          Strikes:{" "}
                          <span className="text-foreground font-medium">
                            {formatWhole(item.strikes)}
                          </span>
                        </p>

                        <p>
                          Total time:{" "}
                          <span className="text-foreground font-medium">
                            {item.totalSeconds.toFixed(2)} s
                          </span>
                        </p>

                        <p>
                          Max channel pressure:{" "}
                          <span className="text-foreground font-medium">
                            {formatWhole(item.maxChannelPressure)}
                          </span>
                        </p>

                        <p>
                          Max high pressure:{" "}
                          <span className="text-foreground font-medium">
                            {formatWhole(item.maxHighPressure)}
                          </span>
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No movement summary available for this bale
                </p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="valves" className="mt-6">
            {valveData.length > 0 ? (
              <Card className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={valveData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      fill={VALVE_COLOR}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">
                No valve data
              </Card>
            )}
          </TabsContent>

          <TabsContent value="cycles" className="mt-6">
            {groupedCycles.length > 0 ? (
              <div className="space-y-4">
                {groupedCycles.map((cycle) => (
                  <Card key={cycle.label} className="p-6">
                    <h4 className="text-lg font-semibold text-foreground">
                      {cycle.label}
                    </h4>

                    <p className="text-sm text-muted-foreground mb-4">
                      Min: {formatWhole(cycle.stats.min)} / Max:{" "}
                      {formatWhole(cycle.stats.max)} / Avg:{" "}
                      {cycle.stats.avg.toFixed(2)} / Count:{" "}
                      {formatWhole(cycle.stats.count)}
                    </p>

                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={cycle.values.map((value, index) => ({
                          index: index + 1,
                          value,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="index" />
                        <YAxis />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          fill={CYCLE_COLOR}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>

                    <details className="mt-4">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Raw values
                      </summary>
                      <p className="text-xs text-muted-foreground mt-2 break-all">
                        [{cycle.values.join(", ")}]
                      </p>
                    </details>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">
                No cycle data available for this bale
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pressure" className="mt-6">
            {groupedPressure.length > 0 ? (
              <div className="space-y-4">
                {groupedPressure.map((pressure) => (
                  <Card key={pressure.label} className="p-6">
                    <h4 className="text-lg font-semibold text-foreground mb-4">
                      {pressure.label}
                    </h4>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {pressure.highPressure.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-3">
                            <span className="font-medium text-foreground">
                              High Pressure
                            </span>{" "}
                            — Min: {formatWhole(pressure.highPressureStats.min)} /
                            Max: {formatWhole(pressure.highPressureStats.max)} /
                            Avg: {pressure.highPressureStats.avg.toFixed(0)}
                          </p>

                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                              data={pressure.highPressure.map(
                                (value, index) => ({
                                  index: index + 1,
                                  value,
                                })
                              )}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="index" />
                              <YAxis />
                              <Tooltip />
                              <Bar
                                dataKey="value"
                                fill={HIGH_PRESSURE_COLOR}
                                radius={[6, 6, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>

                          <details className="mt-4">
                            <summary className="text-xs text-muted-foreground cursor-pointer">
                              Raw values
                            </summary>
                            <p className="text-xs text-muted-foreground mt-2 break-all">
                              [{pressure.highPressure.join(", ")}]
                            </p>
                          </details>
                        </div>
                      )}

                      {pressure.channelPressure.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-3">
                            <span className="font-medium text-foreground">
                              Channel Pressure
                            </span>{" "}
                            — Min:{" "}
                            {formatWhole(pressure.channelPressureStats.min)} /
                            Max:{" "}
                            {formatWhole(pressure.channelPressureStats.max)} /
                            Avg: {pressure.channelPressureStats.avg.toFixed(0)}
                          </p>

                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                              data={pressure.channelPressure.map(
                                (value, index) => ({
                                  index: index + 1,
                                  value,
                                })
                              )}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="index" />
                              <YAxis />
                              <Tooltip />
                              <Bar
                                dataKey="value"
                                fill={CHANNEL_PRESSURE_COLOR}
                                radius={[6, 6, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>

                          <details className="mt-4">
                            <summary className="text-xs text-muted-foreground cursor-pointer">
                              Raw values
                            </summary>
                            <p className="text-xs text-muted-foreground mt-2 break-all">
                              [{pressure.channelPressure.join(", ")}]
                            </p>
                          </details>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">
                No pressure data available for this bale
              </Card>
            )}
          </TabsContent>

          <TabsContent value="raw" className="mt-6">
            <Card className="p-6 overflow-auto">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    bale,
                    cycles: cyclesData?.cycles ?? [],
                    pressure: pressureData?.pressure ?? [],
                  },
                  null,
                  2
                )}
              </pre>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}