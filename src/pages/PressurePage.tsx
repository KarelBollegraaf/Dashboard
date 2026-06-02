import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBales, fetchPressure } from "@/lib/api";
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
} from "recharts";
import { Activity, Gauge, Package, TrendingUp } from "lucide-react";

const HIGH_PRESSURE_COLOR = "#ef4444";
const CHANNEL_PRESSURE_COLOR = "#0ea5e9";

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

type PressureApiItem = {
  label: string;
  highPressure?: number[];
  channelPressure?: number[];
};

type PressureRecord = {
  baleId: number;
  rawId: number;
  baleNumber: number;
  ts: string;
  materialName: string;
  recipeNumber: number;
  label: string;
  highPressure: number[];
  channelPressure: number[];
  highMax: number;
  highAvg: number;
  channelMax: number;
  channelAvg: number;
  highCount: number;
  channelCount: number;
};

type PressureGroup = {
  label: string;
  records: PressureRecord[];
  highValues: number[];
  channelValues: number[];
  highMax: number;
  highAvg: number;
  channelMax: number;
  channelAvg: number;
  highCount: number;
  channelCount: number;
  balesWithData: number;
};

type MaterialGroup = {
  materialName: string;
  records: PressureRecord[];
  highMax: number;
  highAvg: number;
  channelMax: number;
  channelAvg: number;
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

function formatWhole(value: number) {
  return Math.round(Number(value || 0)).toString();
}

function normalizeValues(values: unknown): number[] {
  if (!Array.isArray(values)) return [];

  return values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxValue(values: number[]) {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

function getRange(hours: number) {
  const to = new Date();
  const from = new Date(to);
  from.setHours(to.getHours() - hours);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function buildRecords(
  bales: BaleRow[],
  pressureByRawId: Map<number, PressureApiItem[]>
) {
  const records: PressureRecord[] = [];

  for (const bale of bales) {
    const rawId = Number(bale.raw_id ?? bale.id ?? 0);
    const pressureItems = pressureByRawId.get(rawId) ?? [];

    for (const item of pressureItems) {
      const label = item?.label ?? "Unknown";
      const highPressure = normalizeValues(item?.highPressure);
      const channelPressure = normalizeValues(item?.channelPressure);

      if (highPressure.length === 0 && channelPressure.length === 0) continue;

      records.push({
        baleId: Number(bale.id ?? 0),
        rawId,
        baleNumber: Number(bale.bale_number ?? 0),
        ts: bale.ts ?? "",
        materialName: bale.material_name ?? "Unknown",
        recipeNumber: Number(bale.recipe_number ?? 0),
        label,
        highPressure,
        channelPressure,
        highMax: maxValue(highPressure),
        highAvg: average(highPressure),
        channelMax: maxValue(channelPressure),
        channelAvg: average(channelPressure),
        highCount: highPressure.length,
        channelCount: channelPressure.length,
      });
    }
  }

  return records;
}

function buildPressureGroups(records: PressureRecord[]): PressureGroup[] {
  const grouped = new Map<string, PressureRecord[]>();

  for (const record of records) {
    if (!grouped.has(record.label)) {
      grouped.set(record.label, []);
    }

    grouped.get(record.label)!.push(record);
  }

  return Array.from(grouped.entries())
    .map(([label, groupRecords]) => {
      const highValues = groupRecords.flatMap((record) => record.highPressure);
      const channelValues = groupRecords.flatMap((record) => record.channelPressure);

      return {
        label,
        records: groupRecords.sort(
          (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
        ),
        highValues,
        channelValues,
        highMax: maxValue(highValues),
        highAvg: average(highValues),
        channelMax: maxValue(channelValues),
        channelAvg: average(channelValues),
        highCount: highValues.length,
        channelCount: channelValues.length,
        balesWithData: new Set(groupRecords.map((record) => record.baleId)).size,
      };
    })
    .filter((group) => group.highCount > 0 || group.channelCount > 0)
    .sort(sortMotionLabels);
}

function buildMaterialGroups(records: PressureRecord[]): MaterialGroup[] {
  const grouped = new Map<string, PressureRecord[]>();

  for (const record of records) {
    if (!grouped.has(record.materialName)) {
      grouped.set(record.materialName, []);
    }

    grouped.get(record.materialName)!.push(record);
  }

  return Array.from(grouped.entries())
    .map(([materialName, groupRecords]) => {
      const highValues = groupRecords.flatMap((record) => record.highPressure);
      const channelValues = groupRecords.flatMap((record) => record.channelPressure);

      return {
        materialName,
        records: groupRecords,
        highMax: maxValue(highValues),
        highAvg: average(highValues),
        channelMax: maxValue(channelValues),
        channelAvg: average(channelValues),
        balesWithData: new Set(groupRecords.map((record) => record.baleId)).size,
      };
    })
    .sort((a, b) => b.channelMax - a.channelMax);
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

export default function PressurePage() {
  const [timeframeHours, setTimeframeHours] = useState("1");
  const [selectedMovement, setSelectedMovement] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("all");

  const hours = Number(timeframeHours);
  const range = useMemo(() => getRange(hours), [hours]);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "pressure-overview",
      timeframeHours,
      selectedMaterial,
      range.from,
      range.to,
    ],
    queryFn: async () => {
      const balesData = await fetchBales({
        page: 1,
        limit: 300,
        sort: "ts",
        order: "DESC",
        from: range.from,
        to: range.to,
        material: selectedMaterial === "all" ? undefined : selectedMaterial,
      });

      const bales: BaleRow[] = Array.isArray(balesData?.data)
        ? balesData.data
        : [];

      const pressureByRawId = new Map<number, PressureApiItem[]>();

      await Promise.all(
        bales.map(async (bale) => {
          const rawId = Number(bale.raw_id ?? bale.id ?? 0);

          if (!rawId) {
            pressureByRawId.set(rawId, []);
            return;
          }

          try {
            const pressureData = await fetchPressure(rawId);
            const pressure = Array.isArray(pressureData?.pressure)
              ? pressureData.pressure
              : [];

            pressureByRawId.set(rawId, pressure);
          } catch {
            pressureByRawId.set(rawId, []);
          }
        })
      );

      const records = buildRecords(bales, pressureByRawId);
      const pressureGroups = buildPressureGroups(records);
      const materialGroups = buildMaterialGroups(records);
      const materials = Array.from(
        new Set(bales.map((bale) => bale.material_name ?? "Unknown"))
      ).sort();

      return {
        bales,
        records,
        pressureGroups,
        materialGroups,
        materials,
      };
    },
    refetchInterval: 15000,
    retry: 1,
  });

  const bales = data?.bales ?? [];
  const records = data?.records ?? [];
  const pressureGroups = data?.pressureGroups ?? [];
  const materialGroups = data?.materialGroups ?? [];
  const materials = data?.materials ?? [];

  const activeGroup =
    pressureGroups.find((group) => group.label === selectedMovement) ??
    pressureGroups[0];

  const activeLabel = activeGroup?.label ?? "";

  const trendData =
    activeGroup?.records.map((record) => ({
      bale: `#${record.baleNumber}`,
      baleNumber: record.baleNumber,
      timestamp: record.ts ? new Date(record.ts).toLocaleString() : "—",
      material: record.materialName,
      recipe: record.recipeNumber,

      highMax: record.highCount > 0 ? record.highMax : null,
      highAvg: record.highCount > 0 ? Math.round(record.highAvg) : null,

      channelMax: record.channelCount > 0 ? record.channelMax : null,
      channelAvg: record.channelCount > 0 ? Math.round(record.channelAvg) : null,

      highCount: record.highCount,
      channelCount: record.channelCount,
    })) ?? [];

  const movementOverviewData = pressureGroups.map((group) => ({
    label: group.label,
    highMax: group.highMax || null,
    highAvg: group.highCount > 0 ? Math.round(group.highAvg) : null,
    channelMax: group.channelMax || null,
    channelAvg: group.channelCount > 0 ? Math.round(group.channelAvg) : null,
    bales: group.balesWithData,
  }));

  const highestRecord = [...records].sort(
    (a, b) =>
      Math.max(b.highMax, b.channelMax) - Math.max(a.highMax, a.channelMax)
  )[0];

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
              Material
            </label>
            <Select
              value={selectedMaterial}
              onValueChange={(value) => {
                setSelectedMaterial(value);
                setSelectedMovement("");
              }}
            >
              <SelectTrigger className="w-[200px] bg-background">
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent className="z-[9999] bg-background border border-border shadow-xl">
                <SelectItem value="all">All materials</SelectItem>
                {materials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
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
              disabled={pressureGroups.length === 0}
            >
              <SelectTrigger className="w-[260px] bg-background">
                <SelectValue placeholder="Select movement" />
              </SelectTrigger>
              <SelectContent className="z-[9999] bg-background border border-border shadow-xl">
                {pressureGroups.map((group) => (
                  <SelectItem key={group.label} value={group.label}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing pressure from{" "}
            <span className="font-medium text-foreground">
              {new Date(range.from).toLocaleString()}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {new Date(range.to).toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {error && (
        <Card className="p-6 border-2 border-status-error">
          <p className="text-status-error">Failed to load pressure data.</p>
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
              title="Pressure Records"
              value={records.length}
              icon={Activity}
            />
            <MetricCard
              title="Selected Channel Max"
              value={activeGroup ? formatWhole(activeGroup.channelMax) : "—"}
              icon={Gauge}
            />
            <MetricCard
              title="Highest Pressure"
              value={
                highestRecord
                  ? `#${highestRecord.baleNumber} ${formatWhole(
                      Math.max(highestRecord.highMax, highestRecord.channelMax)
                    )}`
                  : "—"
              }
              icon={TrendingUp}
            />
          </div>

          {pressureGroups.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No pressure data found in the selected timeframe.
            </Card>
          ) : (
            <>
              <Card className="p-6 border-2 border-card-border">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Pressure Overview by Movement
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Red is high pressure. Blue is channel pressure. Lines stop
                    when there is no data and continue when the next value exists.
                  </p>
                </div>

                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart data={movementOverviewData}>
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
                        value: "Pressure",
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
                    />
                    <Line
                      type="monotone"
                      dataKey="highMax"
                      name="High Pressure Max"
                      stroke={HIGH_PRESSURE_COLOR}
                      strokeWidth={3}
                      connectNulls={false}
                      dot={{ r: 4, fill: HIGH_PRESSURE_COLOR }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="channelMax"
                      name="Channel Pressure Max"
                      stroke={CHANNEL_PRESSURE_COLOR}
                      strokeWidth={3}
                      connectNulls={false}
                      dot={{ r: 4, fill: CHANNEL_PRESSURE_COLOR }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>

              {activeGroup && (
                <Card className="p-6 border-2 border-card-border">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      {activeGroup.label} Pressure Trend per Bale
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Two lines: red is high pressure, blue is channel pressure.
                      If a value is missing for a bale, the line stops and starts
                      again at the next available datapoint.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4 mb-6">
                    <Card className="p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        High Pressure Avg
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {formatWhole(activeGroup.highAvg)}
                      </p>
                    </Card>
                    <Card className="p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        High Pressure Max
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {formatWhole(activeGroup.highMax)}
                      </p>
                    </Card>
                    <Card className="p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        Channel Pressure Avg
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {formatWhole(activeGroup.channelAvg)}
                      </p>
                    </Card>
                    <Card className="p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        Channel Pressure Max
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {formatWhole(activeGroup.channelMax)}
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
                          value: "Pressure",
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
                          if (value === null || value === undefined) {
                            return ["No data", name];
                          }

                          return [formatWhole(Number(value)), name];
                        }}
                        labelFormatter={(_, payload: any[]) => {
                          const item = payload?.[0]?.payload;

                          if (!item) return "";

                          return `Bale #${item.baleNumber} · ${item.timestamp} · ${item.material} · Recipe ${item.recipe}`;
                        }}
                      />
                      <ReferenceLine
                        y={Math.round(activeGroup.highAvg)}
                        stroke={HIGH_PRESSURE_COLOR}
                        strokeDasharray="6 6"
                        label={{
                          value: "High avg",
                          position: "insideTopRight",
                        }}
                      />
                      <ReferenceLine
                        y={Math.round(activeGroup.channelAvg)}
                        stroke={CHANNEL_PRESSURE_COLOR}
                        strokeDasharray="6 6"
                        label={{
                          value: "Channel avg",
                          position: "insideBottomRight",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="highMax"
                        name="High Pressure Max"
                        stroke={HIGH_PRESSURE_COLOR}
                        strokeWidth={3}
                        connectNulls={false}
                        dot={{ r: 4, fill: HIGH_PRESSURE_COLOR }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="channelMax"
                        name="Channel Pressure Max"
                        stroke={CHANNEL_PRESSURE_COLOR}
                        strokeWidth={3}
                        connectNulls={false}
                        dot={{ r: 4, fill: CHANNEL_PRESSURE_COLOR }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {materialGroups.length > 0 && (
                <Card className="p-6 border-2 border-card-border">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Material Pressure Breakdown
                  </h3>

                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-3 px-3 font-semibold">
                            Material
                          </th>
                          <th className="text-right py-3 px-3 font-semibold">
                            High Avg
                          </th>
                          <th className="text-right py-3 px-3 font-semibold">
                            High Max
                          </th>
                          <th className="text-right py-3 px-3 font-semibold">
                            Channel Avg
                          </th>
                          <th className="text-right py-3 px-3 font-semibold">
                            Channel Max
                          </th>
                          <th className="text-right py-3 px-3 font-semibold">
                            Bales
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialGroups.map((group) => (
                          <tr
                            key={group.materialName}
                            className="border-b last:border-b-0"
                          >
                            <td className="py-3 px-3 font-medium text-foreground">
                              {group.materialName}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {formatWhole(group.highAvg)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {formatWhole(group.highMax)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {formatWhole(group.channelAvg)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {formatWhole(group.channelMax)}
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
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}