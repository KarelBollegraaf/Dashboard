import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchBaleDetail, fetchCycles, fetchPressure } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type MotionSummaryItem = {
  label: string;
  strikes: number;
  totalSeconds: number;
  maxChannelPressure: number;
  maxHighPressure: number;
};

function buildMotionSummary(cyclesData: any, pressureData: any): MotionSummaryItem[] {
  const cycles = Array.isArray(cyclesData?.cycles) ? cyclesData.cycles : [];
  const pressure = Array.isArray(pressureData?.pressure) ? pressureData.pressure : [];

  return cycles.map((c: any) => {
    const label = c?.label ?? "Unknown";
    const values = Array.isArray(c?.values) ? c.values.map(Number).filter((v: number) => Number.isFinite(v) && v > 0) : [];

    const pressureMatch = pressure.find((p: any) => p?.label === label);

    const highPressure = Array.isArray(pressureMatch?.highPressure)
      ? pressureMatch.highPressure.map(Number).filter((v: number) => Number.isFinite(v) && v > 0)
      : [];

    const channelPressure = Array.isArray(pressureMatch?.channelPressure)
      ? pressureMatch.channelPressure.map(Number).filter((v: number) => Number.isFinite(v) && v > 0)
      : [];

    return {
      label,
      strikes: values.length,
      totalSeconds: values.reduce((sum: number, v: number) => sum + v, 0) / 1000,
      maxChannelPressure: channelPressure.length ? Math.max(...channelPressure) : 0,
      maxHighPressure: highPressure.length ? Math.max(...highPressure) : 0,
    };
  }).filter((row: MotionSummaryItem) =>
    row.strikes > 0 || row.maxChannelPressure > 0 || row.maxHighPressure > 0
  );
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

  const motionSummary = buildMotionSummary(cyclesData, pressureData);

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
        <p className="text-sm text-muted-foreground mt-1">{new Date(bale.ts).toLocaleString()}</p>

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
                ["Recipe #", bale.recipe_number],
                ["Shift", bale.shift_number],
                ["Max High Pressure", maxHighPressure || "—"],
                ["Max Channel Pressure", maxChannelPressure || "—"],
                ["Weight", `${bale.weight?.toFixed(2)} kg`],
                ["Volume", `${bale.volume?.toFixed(2)} m³`],
                ["Bale Length", `${bale.bale_length?.toFixed(2)} cm`],
                ["kWh Used", bale.kwh_used?.toFixed(2)],
                ["Total Time", `${bale.total_time?.toFixed(2)} s`],
                ["Auto Time", `${bale.auto_time?.toFixed(2)} s`],
                ["Standby Time", `${bale.standby_time?.toFixed(2)} s`],
                ["Empty Time", `${bale.empty_time?.toFixed(2)} s`],
                ["Oil Temperature", `${bale.oil_temperature?.toFixed(2)} °C`],
                ["Oil Level", bale.oil_level?.toFixed(2)],
                ["Total Ram Strokes", totalRamStrokes],
                ["Wires H", bale.wires_horizontal],
                ["Knots V", bale.knots_vertical],
                ["Knots H", bale.knots_horizontal],
              ].map(([label, val]) => (
                <Card key={label as string} className="p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">{val ?? "—"}</p>
                </Card>
              ))}
            </div>

            <Card className="p-6 bg-muted/20">
              <h3 className="text-lg font-semibold text-foreground mb-4">Movement Summary</h3>

              {motionSummary.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {motionSummary.map((item) => (
                    <Card key={item.label} className="p-4 bg-background">
                      <p className="font-medium text-foreground mb-2">{item.label}</p>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          Strikes: <span className="text-foreground font-medium">{item.strikes}</span>
                        </p>
                        <p>
                          Total time: <span className="text-foreground font-medium">{item.totalSeconds.toFixed(2)} s</span>
                        </p>
                        <p>
                          Max channel pressure:{" "}
                          <span className="text-foreground font-medium">{item.maxChannelPressure}</span>
                        </p>
                        <p>
                          Max high pressure:{" "}
                          <span className="text-foreground font-medium">{item.maxHighPressure}</span>
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No movement summary available for this bale</p>
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
                    <Bar dataKey="value" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">No valve data</Card>
            )}
          </TabsContent>

          <TabsContent value="cycles" className="mt-6">
            {cyclesData?.cycles?.length ? (
              <div className="space-y-4">
                {cyclesData.cycles.map((c: any, i: number) => (
                  <Card key={i} className="p-6">
                    <h4 className="text-lg font-semibold text-foreground">{c.label}</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Min: {c.stats.min} Max: {c.stats.max} Avg: {c.stats.avg} Count: {c.stats.count}
                    </p>

                    {c.values.length > 0 && (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={c.values.map((v: number, idx: number) => ({ index: idx + 1, value: v }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="index" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    <p className="text-xs text-muted-foreground mt-4">Values: [{c.values.join(", ")}]</p>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">No cycle data available for this bale</Card>
            )}
          </TabsContent>

          <TabsContent value="pressure" className="mt-6">
            {pressureData?.pressure?.length ? (
              <div className="space-y-4">
                {pressureData.pressure.map((p: any, i: number) => (
                  <Card key={i} className="p-6">
                    <h4 className="text-lg font-semibold text-foreground">{p.label}</h4>

                    {p.highPressure.length > 0 && (
                      <>
                        <p className="text-sm text-muted-foreground mb-3">
                          High Pressure — Min: {p.highPressureStats.min} / Max: {p.highPressureStats.max} / Avg: {p.highPressureStats.avg}
                        </p>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={p.highPressure.map((v: number, idx: number) => ({ i: idx + 1, v }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="i" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="v" />
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    )}

                    {p.channelPressure.length > 0 && (
                      <>
                        <p className="text-sm text-muted-foreground mt-6 mb-3">
                          Channel Pressure — Min: {p.channelPressureStats.min} / Max: {p.channelPressureStats.max} / Avg: {p.channelPressureStats.avg}
                        </p>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={p.channelPressure.map((v: number, idx: number) => ({ i: idx + 1, v }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="i" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="v" />
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">No pressure data available for this bale</Card>
            )}
          </TabsContent>

          <TabsContent value="raw" className="mt-6">
            {bale.parsedPayload ? (
              <Card className="p-6 overflow-auto">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(bale.parsedPayload, null, 2)}
                </pre>
              </Card>
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">No raw payload data linked to this bale</Card>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}