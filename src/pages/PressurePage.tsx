import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBales, fetchPressure } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ParsedPressure } from "@/types/database";

export default function PressurePage() {
  const [selectedBaleId, setSelectedBaleId] = useState<number | null>(null);

  const { data: balesData, isLoading: balesLoading } = useQuery({
    queryKey: ["bales-for-pressure"],
    queryFn: () => fetchBales({ limit: 50, sort: "ts", order: "DESC" }),
  });

  const selectedBale = balesData?.data.find(b => b.id === selectedBaleId);
  const rawId = selectedBale?.raw_id;

  const { data: pressureData, isLoading: pressureLoading } = useQuery({
    queryKey: ["pressure", rawId],
    queryFn: () => fetchPressure(rawId!),
    enabled: !!rawId,
  });

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

      {(balesLoading || pressureLoading) && <Skeleton className="h-48" />}

      {!rawId && selectedBaleId && (
        <Card className="p-6 text-center text-muted-foreground">No raw data linked to this bale</Card>
      )}

      {pressureData?.pressure?.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">No pressure data in this bale's raw message</Card>
      )}

      {pressureData?.pressure?.map((p: ParsedPressure, i: number) => (
        <PressureCard key={i} pressure={p} />
      ))}
    </div>
  );
}

function PressureCard({ pressure }: { pressure: ParsedPressure }) {
  return (
    <Card className="p-6 border-2 border-card-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">{pressure.label}</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pressure.highPressure.length > 0 && (
          <div>
            <div className="flex gap-4 text-sm text-muted-foreground mb-2">
              <span className="font-medium text-foreground">High Pressure</span>
              <span>Min: {pressure.highPressureStats.min}</span>
              <span>Max: {pressure.highPressureStats.max}</span>
              <span>Avg: {pressure.highPressureStats.avg}</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pressure.highPressure.map((v, i) => ({ i: i + 1, value: v }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="i" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="value" fill="hsl(var(--status-error))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer">Raw values</summary>
              <pre className="text-xs bg-muted p-2 rounded mt-1">[{pressure.highPressure.join(", ")}]</pre>
            </details>
          </div>
        )}

        {pressure.channelPressure.length > 0 && (
          <div>
            <div className="flex gap-4 text-sm text-muted-foreground mb-2">
              <span className="font-medium text-foreground">Channel Pressure</span>
              <span>Min: {pressure.channelPressureStats.min}</span>
              <span>Max: {pressure.channelPressureStats.max}</span>
              <span>Avg: {pressure.channelPressureStats.avg}</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pressure.channelPressure.map((v, i) => ({ i: i + 1, value: v }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="i" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer">Raw values</summary>
              <pre className="text-xs bg-muted p-2 rounded mt-1">[{pressure.channelPressure.join(", ")}]</pre>
            </details>
          </div>
        )}
      </div>
    </Card>
  );
}
