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

type MovementGroup = {
  label: string;
  records: PressureRecord[];
  highMax: number;
  highAvg: number;
  channelMax: number;
  channelAvg: number;
  balesWithData: number;
  events: number;
};

type MaterialGroup = {
  materialName: string;
  records: PressureRecord[];
  highMax: number;
  highAvg: number;
  channelMax: number;
  channelAvg: number;
  balesWithData: number;
  events: number;
};

function getMotionOrder(label: string) {
  const index = MOTION_ORDER.findIndex(
    (item) => item.toLowerCase() === String(label).toLowerCase()
  );

  return index === -1 ? 999 : index;
}

function sortByTimeAndMovement(a: PressureRecord, b: PressureRecord) {
  const timeCompare = a.ts.localeCompare(b.ts);

  if (timeCompare !== 0) return timeCompare;

  const orderA = getMotionOrder(a.label);
  const orderB = getMotionOrder(b.label);

  if (orderA !== orderB) return orderA - orderB;

  return a.label.localeCompare(b.label);
}

function sortMovementLabels(a: { label: string }, b: { label: string }) {
  const orderA = getMotionOrder(a.label);
  const orderB = getMotionOrder(b.label);

  if (orderA !== orderB) return orderA - orderB;

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

function toDbDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  return String(value).replace("T", " ").replace(/\.\d{3}Z$/, "").replace(/Z$/, "");
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

  return records.sort(sortByTimeAndMovement);
}

function buildMovementGroups(records: PressureRecord[]): MovementGroup[] {
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
        records: groupRecords,
        highMax: maxValue(highValues),
        highAvg: average(highValues),
        channelMax: maxValue(channelValues),
        channelAvg: average(channelValues),
        balesWithData: new Set(groupRecords.map((record) => record.baleId)).size,
        events: groupRecords.length,
      };
    })
    .sort(sortMovementLabels);
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
        events: groupRecords.length,
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
  const [selectedMaterial, setSelectedMaterial] = useState("all");

  const hours = Number(timeframeHours);
  const range = useMemo(() => getRange(hours), [hours]);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "pressure-total-overview",
      timeframeHours,
      selectedMaterial,
      range.from,
      range.to,
    ],
    queryFn: async () => {
      const allBalesData = await fetchBales({
        page: 1,
        limit: 300,
        sort: "ts",
        order: "DESC",
        from: range.from,
        to: range.to,
      });

      const allBales: BaleRow[] = Array.isArray(allBalesData?.data)
        ? allBalesData.data
        : [];

      const filteredBales =
        selectedMaterial === "all"
          ? allBales
          : allBales.filter(
              (bale) => (bale.material_name ?? "Unknown") === selectedMaterial
            );

      const pressureByRawId = new Map<number, PressureApiItem[]>();

      await Promise.all(
        filteredBales.map(async (bale) => {
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

      const records = buildRecords(filteredBales, pressureByRawId);
      const movementGroups = buildMovementGroups(records);
      const materialGroups = buildMaterialGroups(records);
      const materials = Array.from(
        new Set(allBales.map((bale) => bale.material_name ?? "Unknown"))
      ).sort();

      return {
        bales: filteredBales,
        records,
        movementGroups,
        materialGroups,
        materials,
      };
    },
    refetchInterval: 15000,
    retry: 1,
  });

  const bales = data?.bales ?? [];
  const records = data?.records ?? [];
  const movementGroups = data?.movementGroups ?? [];
  const materialGroups = data?.materialGroups ?? [];
  const materials = data?.materials ?? [];

  const highValues = records.flatMap((record) => record.highPressure);
  const channelValues = records.flatMap((record) => record.channelPressure);

  const highAvg = average(highValues);
  const highMax = maxValue(highValues);
  const channelAvg = average(channelValues);
  const channelMax = maxValue(channelValues);

  const pressureTimelineData = records.map((record, index) => ({
    index: index + 1,
    label: `#${record.baleNumber}`,
    baleNumber: record.baleNumber,
    movement: record.label,
    timestamp: formatTimestamp(record.ts),
    material: record.materialName,
    recipe: record.recipeNumber,
    highMax: record.highCount > 0 ? record.highMax : null,
    channelMax: record.channelCount > 0 ? record.channelMax : null,
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
            <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
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

          <div className="text-sm text-muted-foreground">
            Showing all pressure events from{" "}
            <span className="font-medium text-foreground">
              {formatTimestamp(range.from)}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {formatTimestamp(range.to)}
            </span>
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
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
              title="Pressure Events"
              value={records.length}
              icon={Activity}
            />
            <MetricCard
              title="Channel Pressure Max"
              value={formatWhole(channelMax)}
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

          {records.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No pressure data found in the selected timeframe.
            </Card>
          ) : (
            <>
              <Card className="p-6 border-2 border-card-border">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Total Pressure Timeline
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This graph shows all movements in one pressure timeline. Red
                    is high pressure. Blue is channel pressure. Hover a point to
                    see which movement caused the pressure.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <Card className="p-4 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      High Pressure Avg
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {formatWhole(highAvg)}
                    </p>
                  </Card>
                  <Card className="p-4 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      High Pressure Max
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {formatWhole(highMax)}
                    </p>
                  </Card>
                  <Card className="p-4 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Channel Pressure Avg
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {formatWhole(channelAvg)}
                    </p>
                  </Card>
                  <Card className="p-4 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Channel Pressure Max
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {formatWhole(channelMax)}
                    </p>
                  </Card>
                </div>

                <ResponsiveContainer width="100%" height={460}>
                  <ComposedChart data={pressureTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
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

                        return `Bale #${item.baleNumber} · ${item.movement} · ${item.timestamp} · ${item.material} · Recipe ${item.recipe}`;
                      }}
                    />
                    <ReferenceLine
                      y={Math.round(highAvg)}
                      stroke={HIGH_PRESSURE_COLOR}
                      strokeDasharray="6 6"
                      label={{
                        value: "High avg",
                        position: "insideTopRight",
                      }}
                    />
                    <ReferenceLine
                      y={Math.round(channelAvg)}
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

                <div className="mt-4 text-sm text-muted-foreground">
                  A spike means one movement in that bale created higher pressure.
                  Hover the point to see exactly which movement it was.
                </div>
              </Card>

              <Card className="p-6 border-2 border-card-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Pressure by Movement
                </h3>

                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-3 font-semibold">
                          Movement
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
                          Events
                        </th>
                        <th className="text-right py-3 px-3 font-semibold">
                          Bales
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementGroups.map((group) => (
                        <tr key={group.label} className="border-b last:border-b-0">
                          <td className="py-3 px-3 font-medium text-foreground">
                            {group.label}
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
                            {formatWhole(group.events)}
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
                            Events
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
                              {formatWhole(group.events)}
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