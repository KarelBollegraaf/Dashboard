import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOverviewWithRange } from "@/lib/api";
import { adaptOverview } from "@/lib/dashboardAdapter";
import { Card } from "@/components/ui/card";
import {
  getQualityRules,
  resetQualityRules,
  saveQualityRules,
  type QualityRules,
} from "@/lib/baleQuality";

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function RuleGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 border-2 border-card-border">
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </Card>
  );
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

export default function QualityRulesPage() {
  const [selectedMaterial, setSelectedMaterial] = useState("KARTON");
  const [rules, setRules] = useState<QualityRules>(() =>
    getQualityRules("KARTON")
  );
  const [savedMessage, setSavedMessage] = useState("");

  const now = useMemo(() => new Date(), []);

  const from = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, [now]);

  const to = useMemo(() => toDbDateTime(now), [now]);

  const overviewQuery = useQuery({
    queryKey: ["quality-rules-materials", from, to],
    queryFn: () =>
      fetchOverviewWithRange({
        from,
        to,
        materials: [],
        recipes: [],
      }),
    retry: 1,
  });

  const overview = adaptOverview(overviewQuery.data);

  const materialOptions =
    overview.filters?.materials && overview.filters.materials.length > 0
      ? overview.filters.materials
      : ["KARTON"];

  const updateRule = (key: keyof QualityRules, value: number) => {
    setRules((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSavedMessage("");
  };

  const changeMaterial = (material: string) => {
    setSelectedMaterial(material);
    setRules(getQualityRules(material));
    setSavedMessage("");
  };

  const save = () => {
    saveQualityRules(selectedMaterial, rules);
    setRules(getQualityRules(selectedMaterial));
    setSavedMessage(`Saved rules for ${selectedMaterial}`);
  };

  const reset = () => {
    resetQualityRules(selectedMaterial);
    setRules(getQualityRules(selectedMaterial));
    setSavedMessage(`Reset ${selectedMaterial} to default rules`);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 border-2 border-card-border">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Quality Rules</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Set the bale quality limits per material. These rules are used on
              the Overview page and the Bales page.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Material</label>
              <select
                value={selectedMaterial}
                onChange={(e) => changeMaterial(e.target.value)}
                className="mt-1 w-[220px] rounded border bg-background px-3 py-2 text-sm"
              >
                {materialOptions.map((material: string) => (
                  <option key={material} value={material}>
                    {material}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={reset}
              className="rounded border bg-background px-4 py-2 text-sm"
            >
              Reset
            </button>

            <button
              onClick={save}
              className="rounded border border-primary bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>

        {savedMessage && (
          <div className="mt-4 rounded border bg-muted/30 px-3 py-2 text-sm">
            {savedMessage}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <RuleGroup title="Weight limits">
          <NumberInput
            label="GOOD min weight kg"
            value={rules.goodMinWeight}
            onChange={(v) => updateRule("goodMinWeight", v)}
          />
          <NumberInput
            label="GOOD max weight kg"
            value={rules.goodMaxWeight}
            onChange={(v) => updateRule("goodMaxWeight", v)}
          />
          <NumberInput
            label="OK min weight kg"
            value={rules.okMinWeight}
            onChange={(v) => updateRule("okMinWeight", v)}
          />
          <NumberInput
            label="OK max weight kg"
            value={rules.okMaxWeight}
            onChange={(v) => updateRule("okMaxWeight", v)}
          />
        </RuleGroup>

        <RuleGroup title="Length limits">
          <NumberInput
            label="GOOD min length mm"
            value={rules.goodMinLength}
            onChange={(v) => updateRule("goodMinLength", v)}
          />
          <NumberInput
            label="GOOD max length mm"
            value={rules.goodMaxLength}
            onChange={(v) => updateRule("goodMaxLength", v)}
          />
          <NumberInput
            label="OK min length mm"
            value={rules.okMinLength}
            onChange={(v) => updateRule("okMinLength", v)}
          />
          <NumberInput
            label="OK max length mm"
            value={rules.okMaxLength}
            onChange={(v) => updateRule("okMaxLength", v)}
          />
        </RuleGroup>

        <RuleGroup title="Density limits">
          <NumberInput
            label="GOOD min density kg/m³"
            value={rules.goodMinDensity}
            onChange={(v) => updateRule("goodMinDensity", v)}
          />
          <NumberInput
            label="GOOD max density kg/m³"
            value={rules.goodMaxDensity}
            onChange={(v) => updateRule("goodMaxDensity", v)}
          />
          <NumberInput
            label="OK min density kg/m³"
            value={rules.okMinDensity}
            onChange={(v) => updateRule("okMinDensity", v)}
          />
          <NumberInput
            label="OK max density kg/m³"
            value={rules.okMaxDensity}
            onChange={(v) => updateRule("okMaxDensity", v)}
          />
        </RuleGroup>

        <RuleGroup title="Machine limits">
          <NumberInput
            label="GOOD max high pressure"
            value={rules.maxGoodHighPressure}
            onChange={(v) => updateRule("maxGoodHighPressure", v)}
          />
          <NumberInput
            label="OK max high pressure"
            value={rules.maxOkHighPressure}
            onChange={(v) => updateRule("maxOkHighPressure", v)}
          />
          <NumberInput
            label="GOOD max channel pressure"
            value={rules.maxGoodChannelPressure}
            onChange={(v) => updateRule("maxGoodChannelPressure", v)}
          />
          <NumberInput
            label="OK max channel pressure"
            value={rules.maxOkChannelPressure}
            onChange={(v) => updateRule("maxOkChannelPressure", v)}
          />
          <NumberInput
            label="GOOD max total time s"
            value={rules.maxGoodTotalTime}
            onChange={(v) => updateRule("maxGoodTotalTime", v)}
          />
          <NumberInput
            label="OK max total time s"
            value={rules.maxOkTotalTime}
            onChange={(v) => updateRule("maxOkTotalTime", v)}
          />
        </RuleGroup>

        <RuleGroup title="Ram stroke limits">
          <NumberInput
            label="GOOD min ram strokes"
            value={rules.goodMinRamStrokes}
            onChange={(v) => updateRule("goodMinRamStrokes", v)}
          />
          <NumberInput
            label="GOOD max ram strokes"
            value={rules.goodMaxRamStrokes}
            onChange={(v) => updateRule("goodMaxRamStrokes", v)}
          />
          <NumberInput
            label="OK min ram strokes"
            value={rules.okMinRamStrokes}
            onChange={(v) => updateRule("okMinRamStrokes", v)}
          />
          <NumberInput
            label="OK max ram strokes"
            value={rules.okMaxRamStrokes}
            onChange={(v) => updateRule("okMaxRamStrokes", v)}
          />
        </RuleGroup>

        <Card className="p-4 border-2 border-card-border bg-muted/20">
          <h3 className="text-base font-semibold mb-3">
            How quality is scored
          </h3>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              GOOD means the bale is inside the good range for weight, length
              and density, and machine limits are not too high.
            </p>
            <p>
              OK means the bale is outside the perfect range, but still inside
              the accepted range.
            </p>
            <p>
              WARNING means the bale is outside the allowed range or has high
              machine values.
            </p>
            <p>
              UNKNOWN means there is not enough bale data to score it.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}