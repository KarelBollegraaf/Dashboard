import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBales, fetchCycles } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ParsedCycle } from "@/types/database";

export default function CycleTimesPage() {
  const [selectedBaleId, setSelectedBaleId] = useState<number | null>(null);

  // Fetch recent bales to let user pick one
  const { data: balesData, isLoading: balesLoading } = useQuery({
    queryKey: ["bales-for-cycles"],
    queryFn: () => fetchBales({ limit: 50, sort: "ts", order: "DESC" }),
  });

  // Get raw_id for selected bale
  const selectedBale = balesData?.data.find(b => b.id === selectedBaleId);
  const rawId = selectedBale?.raw_id;

  const { data: cyclesData, isLoading: cyclesLoading } = useQuery({
    queryKey: ["cycles", rawId],
    queryFn: () => fetchCycles(rawId!),
    enabled: !!rawId,
  });

  // Auto-select first bale
  if (!selectedBaleId && balesData?.data.length) {
    setSelectedBaleId(balesData.data[0].id);
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 border-2 border-card-border">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-foreground">Select Bale:</label>
          <Select
            value={selectedBaleId?.toString() || ""}
            onValueChange={(v) => setSelectedBaleId(Number(v))}
          >
            <SelectTrigger className="w-[350px]">
              <SelectValue placeholder="Select a bale..." />
            </SelectTrigger>
            <SelectContent>
              {balesData?.data.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  #{b.bale_number} — {b.material_name} — {new Date(b.ts).toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {balesLoading && <Skeleton className="h-48" />}

      {cyclesLoading && <Skeleton className="h-48" />}

      {!rawId && selectedBaleId && (
        <Card className="p-6 text-center text-muted-foreground">No raw data linked to this bale</Card>
      )}

      {cyclesData?.cycles?.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">No cycle data in this bale's raw message</Card>
      )}

      {cyclesData?.cycles?.map((cycle: ParsedCycle, i: number) => (
        <CycleCard key={i} cycle={cycle} />
      ))}
    </div>
  );
}

function CycleCard({ cycle }: { cycle: ParsedCycle }) {
  const chartData = cycle.values.map((v, i) => ({ step: i + 1, time: v }));

  return (
    <Card className="p-6 border-2 border-card-border">
      <h3 className="text-lg font-semibold text-foreground mb-2">{cycle.label}</h3>
      <div className="flex gap-6 text-sm text-muted-foreground mb-4">
        <span>Min: <strong className="text-foreground">{cycle.stats.min}</strong></span>
        <span>Max: <strong className="text-foreground">{cycle.stats.max}</strong></span>
        <span>Avg: <strong className="text-foreground">{cycle.stats.avg}</strong></span>
        <span>Values: <strong className="text-foreground">{cycle.stats.count}</strong></span>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="step" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="time" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-muted-foreground text-sm">No values</p>
      )}

      <details className="mt-3">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Raw values</summary>
        <pre className="text-xs bg-muted p-2 rounded mt-1 text-foreground">[{cycle.values.join(", ")}]</pre>
      </details>
    </Card>
  );
}
