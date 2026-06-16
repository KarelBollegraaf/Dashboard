import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBales, fetchCycles } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
} from "recharts";
import { Activity, Clock, Gauge, Package } from "lucide-react";

const CYCLE_COLOR = "#f97316";
const AVERAGE_LINE_COLOR = "#2563eb";
const MAX_LINE_COLOR = "#0ea5e9";

const MOTION_ORDER = [
  "Ram Forward",
  "Ram Reverse",
  "Ram Backward",
  "Ram Backwards",
  "Flap Forward",
  "Flap Reverse",
  "Flap Backward",
  "Flap Backwards",
  "NeedlesVertical Forward",
  "NeedlesVertical Reverse",
  "NeedlesHorizontal Forward",
  "NeedlesHorizontal Reverse",
];

type BaleRow = {
  id: number;
  raw_id?: number;
  bale_number: number;
  ts: string;
  material_name?: string;
  recipe_number?: number;
};

type CycleApiItem = {
  label: string;
  values: number[];
  stats?: {
    min?: number;
    max?: number;
    avg?: number;
    count?: number;
  };
};

type BaleCycleRecord = {
  baleId: number;
  rawId: number;
  baleNumber: number;
  ts: string;
  materialName: string;
  recipeNumber: number;
  label: string;
  valuesMs: number[];
  avgSeconds: number;
  totalSeconds: number;
  maxSeconds: number;
  count: number;
};

type MotionGroup = {
  label: string;
  records: BaleCycleRecord[];
  allValuesMs: number[];
  count: number;
  avgSeconds: number;
  minSeconds: number;
  maxSeconds: number;
  totalSeconds: number;
  balesWithData: number;
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

function formatSeconds(value: number) {
  return `${Number(value || 0).toFixed(2)} s`;
}

function formatWhole(value: number) {
  return Math.round(Number(value || 0)).toString();
}

function normalizeValues(values: unknown): number[] {
  if (!Array.isArray(values)) return [];

  return values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
}

function getAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDbDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getRange(hours: number) {
  const to = new Date();
  const from = new Date(to);
  from.setHours(to.getHours() - hours);

  return {
    from: toDbDateTime(from),
    to: toDbDateTime(to),
  };
}

function buildRecords(bales: BaleRow[], cyclesByRawId: Map<number, CycleApiItem[]>) {
  const records: BaleCycleRecord[] = [];

  for (const bale of bales) {
    const rawId = Number(bale.raw_id ?? bale.id ?? 0);
    const cycles = cyclesByRawId.get(rawId) ?? [];

    for (const cycle of cycles) {
      const label = cycle?.label ?? "Unknown";
      const valuesMs = normalizeValues(cycle?.values);

      if (valuesMs.length === 0) continue;

      const avgMs = getAverage(valuesMs);
      const totalMs = valuesMs.reduce((sum, value) => sum + value, 0);
      const maxMs = Math.max(...valuesMs);

      records.push({
        baleId: Number(bale.id ?? 0),
        rawId,
        baleNumber: Number(bale.bale_number ?? 0),
        ts: bale.ts ?? "",
        materialName: bale.material_name ?? "Unknown",
        recipeNumber: Number(bale.recipe_number ?? 0),
        label,
        valuesMs,
        avgSeconds: avgMs / 1000,
        totalSeconds: totalMs / 1000,
        maxSeconds: maxMs / 1000,
        count: valuesMs.length,
      });
    }
  }

  return records;
}

function buildMotionGroups(records: BaleCycleRecord[]): MotionGroup[] {
  const grouped = new Map<string, BaleCycleRecord[]>();

  for (const record of records) {
    if (!grouped.has(record.label)) {
      grouped.set(record.label, []);
    }

    grouped.get(record.label)!.push(record);
  }

  return Array.from(grouped.entries())
    .map(([label, groupRecords]) => {
      const allValuesMs = groupRecords.flatMap((record) => record.valuesMs);
      const allValuesSeconds = allValuesMs.map((value) => value / 1000);
      const totalSeconds = allValuesSeconds.reduce((sum, value) => sum + value, 0);
      const avgSeconds = allValuesSeconds.length
        ? totalSeconds / allValuesSeconds.length
        : 0;

      return {
        label,
        records: groupRecords.sort((a, b) => {
          return a.ts.localeCompare(b.ts);
        }),
        allValuesMs,
        count: allValuesMs.length,
        avgSeconds,
        minSeconds: allValuesSeconds.length ? Math.min(...allValuesSeconds) : 0,
        maxSeconds: allValuesSeconds.length ? Math.max(...allValuesSeconds) : 0,
        totalSeconds,
        balesWithData: new Set(groupRecords.map((record) => record.baleId)).size,
      };
    })
    .filter((group) => group.count > 0)
    .sort(sortMotionLabels);
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: any;
}) {
  return (
    <Card className="p-5 border-2 border-card-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
        </div>
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
    </Card>
  );
}

export default function CycleTimesPage() {
  const [timeframeHours, setTimeframeHours] = useState("1");
  const [selectedMovement, setSelectedMovement] = useState("");

  const hours = Number(timeframeHours);
  const range = useMemo(() => getRange(hours), [hours]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cycle-times-overview", timeframeHours, range.from, range.to],
    queryFn: async () => {
      const balesData = await fetchBales({
        page: 1,
        limit: 300,
        sort: "ts",
        order: "DESC",
        from: range.from,
        to: range.to,
      });

      const bales: BaleRow[] = Array.isArray(balesData?.data)
        ? balesData.data
        : [];

      const cyclesByRawId = new Map<number, CycleApiItem[]>();

      await Promise.all(
        bales.map(async (bale) => {
          const rawId = Number(bale.raw_id ?? bale.id ?? 0);

          if (!rawId) {
            cyclesByRawId.set(rawId, []);
            return;
          }

          try {
            const cyclesData = await fetchCycles(rawId);
            const cycles = Array.isArray(cyclesData?.cycles)
              ? cyclesData.cycles
              : [];

            cyclesByRawId.set(rawId, cycles);
          } catch {
            cyclesByRawId.set(rawId, []);
          }
        })
      );

      const records = buildRecords(bales, cyclesByRawId);
      const motionGroups = buildMotionGroups(records);

      return {
        bales,
        records,
        motionGroups,
      };
    },
    refetchInterval: 15000,
    retry: 1,
  });

  const bales = data?.bales ?? [];
  const records = data?.records ?? [];
  const motionGroups = data?.motionGroups ?? [];

  const activeMovement =
    motionGroups.find((group) => group.label === selectedMovement) ??
    motionGroups[0];

  const activeLabel = activeMovement?.label ?? "";
  const selectedGroup = activeMovement;

  const trendData =
    selectedGroup?.records.map((record) => ({
      bale: `#${record.baleNumber}`,
      baleNumber: record.baleNumber,
      timestamp: record.ts || "—",
      material: record.materialName,
      recipe: record.recipeNumber,
      avgSeconds: Number(record.avgSeconds.toFixed(3)),
      maxSeconds: Number(record.maxSeconds.toFixed(3)),
      totalSeconds: Number(record.totalSeconds.toFixed(3)),
      count: record.count,
    })) ?? [];

  const movementBarData = motionGroups.map((group) => ({
    label: group.label,
    avgSeconds: Number(group.avgSeconds.toFixed(3)),
    maxSeconds: Number(group.maxSeconds.toFixed(3)),
    count: group.count,
    bales: group.balesWithData,
  }));

  const selectedCycleValues = selectedGroup?.count ?? 0;
  const selectedBalesWithData = selectedGroup?.balesWithData ?? 0;
  const selectedAverage = selectedGroup ? formatSeconds(selectedGroup.avgSeconds) : "—";
  const selectedMax = selectedGroup ? formatSeconds(selectedGroup.maxSeconds) : "—";

  return (
    <div className="space-y-6">
      <Card className="p-4 border-2 border-card-border overflow-visible relative z-20">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Timeframe
            </label>
            <Select value={timeframeHours} onValueChange={setTimeframeHours}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent className="z-[9999] bg-background border border-border shadow-xl">
                <SelectItem value="1">Last 1 hour</SelectItem>
                <SelectItem value="2">Last 2 hours</SelectItem>
                <SelectItem value="4">Last 4 hours</SelectItem>
                <SelectItem value="8">Last 8 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Movement
            </label>
            <Select
              value={activeLabel}
              onValueChange={setSelectedMovement}
              disabled={motionGroups.length === 0}
            >
              <SelectTrigger className="w-[260px] bg-background">
                <SelectValue placeholder="Select movement" />
              </SelectTrigger>
              <SelectContent className="z-[9999] bg-background border border-border shadow-xl">
                {motionGroups.map((group) => (
                  <SelectItem key={group.label} value={group.label}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing cycles from{" "}
            <span className="font-medium text-foreground">
              {range.from}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {range.to}
            </span>
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {error && (
        <Card className="p-6 border-2 border-status-error">
          <p className="text-status-error">Failed to load cycle times.</p>
        </Card>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Bales in Timeframe"
              value={bales.length}
              icon={Package}
            />
            <MetricCard
              title="Selected Cycle Values"
              value={selectedCycleValues}
              icon={Activity}
            />
            <MetricCard
              title="Selected Average"
              value={selectedAverage}
              icon={Gauge}
            />
            <MetricCard
              title="Selected Max"
              value={selectedMax}
              icon={Clock}
            />
          </div>

          <Card className="p-4 border-2 border-card-border">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Movements Found</p>
                <p className="text-2xl font-bold text-foreground">
                  {motionGroups.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Bales with selected movement
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {selectedBalesWithData}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Selected movement
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {activeLabel || "—"}
                </p>
              </div>
            </div>
          </Card>

          {motionGroups.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No cycle data found in the selected timeframe.
            </Card>
          ) : (
            <>
              <Card className="p-6 border-2 border-card-border">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Movement Average Overview
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Average cycle time per movement in the selected timeframe.
                    This makes it easy to see which movement is slowest overall.
                  </p>
                </div>

                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={movementBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      label={{
                        value: "Seconds",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: any, name: any) => {
                        const numberValue = Number(value);

                        if (!Number.isFinite(numberValue)) {
                          return [value, name];
                        }

                        if (name === "avgSeconds") {
                          return [`${numberValue.toFixed(2)} s`, "Average"];
                        }

                        if (name === "maxSeconds") {
                          return [`${numberValue.toFixed(2)} s`, "Max"];
                        }

                        return [numberValue, name];
                      }}
                    />
                    <Bar
                      dataKey="avgSeconds"
                      name="Average"
                      fill={CYCLE_COLOR}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {selectedGroup && (
                <Card className="p-6 border-2 border-card-border">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      {selectedGroup.label} Trend per Bale
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Bars show the average time for this movement per bale. The
                      blue line shows the max time in that bale. The reference
                      line is the average for the selected timeframe.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4 mb-6">
                    <Card className="p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatSeconds(selectedGroup.avgSeconds)}
                      </p>
                    </Card>
                    <Card className="p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Max</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatSeconds(selectedGroup.maxSeconds)}
                      </p>
                    </Card>
                    <Card className="p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Count</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatWhole(selectedGroup.count)}
                      </p>
                    </Card>
                    <Card className="p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        Bales with data
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {formatWhole(selectedGroup.balesWithData)}
                      </p>
                    </Card>
                  </div>

                  <ResponsiveContainer width="100%" height={420}>
                    <ComposedChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="bale"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        label={{
                          value: "Seconds",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: any, name: any) => {
                          const numberValue = Number(value);

                          if (!Number.isFinite(numberValue)) {
                            return [value, name];
                          }

                          if (name === "avgSeconds") {
                            return [`${numberValue.toFixed(2)} s`, "Avg time"];
                          }

                          if (name === "maxSeconds") {
                            return [`${numberValue.toFixed(2)} s`, "Max time"];
                          }

                          if (name === "count") {
                            return [formatWhole(numberValue), "Count"];
                          }

                          return [value, name];
                        }}
                        labelFormatter={(_, payload: any[]) => {
                          const item = payload?.[0]?.payload;

                          if (!item) return "";

                          return `Bale #${item.baleNumber} · ${item.timestamp} · ${item.material} · Recipe ${item.recipe}`;
                        }}
                      />
                      <ReferenceLine
                        y={Number(selectedGroup.avgSeconds.toFixed(3))}
                        stroke={AVERAGE_LINE_COLOR}
                        strokeDasharray="6 6"
                        label={{
                          value: "Timeframe avg",
                          position: "insideTopRight",
                        }}
                      />
                      <Bar
                        dataKey="avgSeconds"
                        name="Avg time"
                        fill={CYCLE_COLOR}
                        radius={[6, 6, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="maxSeconds"
                        name="Max time"
                        stroke={MAX_LINE_COLOR}
                        strokeWidth={3}
                        dot={{ r: 3, fill: MAX_LINE_COLOR }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  <div className="mt-4 text-sm text-muted-foreground">
                    Use this graph to check if one bale suddenly takes longer
                    than the normal average. A high bar or high blue point means
                    that movement was slower for that bale.
                  </div>
                </Card>
              )}

              <Card className="p-6 border-2 border-card-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Movement Details
                </h3>

                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-3 font-semibold">
                          Movement
                        </th>
                        <th className="text-right py-3 px-3 font-semibold">
                          Avg
                        </th>
                        <th className="text-right py-3 px-3 font-semibold">
                          Min
                        </th>
                        <th className="text-right py-3 px-3 font-semibold">
                          Max
                        </th>
                        <th className="text-right py-3 px-3 font-semibold">
                          Count
                        </th>
                        <th className="text-right py-3 px-3 font-semibold">
                          Bales
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {motionGroups.map((group) => (
                        <tr key={group.label} className="border-b last:border-b-0">
                          <td className="py-3 px-3 font-medium text-foreground">
                            {group.label}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {formatSeconds(group.avgSeconds)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {formatSeconds(group.minSeconds)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {formatSeconds(group.maxSeconds)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {formatWhole(group.count)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {formatWhole(group.balesWithData)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}