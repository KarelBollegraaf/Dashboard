export type QualityStatus = "GOOD" | "OK" | "WARNING" | "UNKNOWN";

export type BaleQualityInput = {
  materialName?: string;
  baleNumber?: number;
  weight?: number;
  volume?: number;
  baleLength?: number;
  totalTime?: number;
  autoTime?: number;
  kwhUsed?: number;
  ramStrokes?: number;
  maxHighPressure?: number;
  maxChannelPressure?: number;
};

export type QualityRules = {
  materialName: string;

  goodMinWeight: number;
  goodMaxWeight: number;
  okMinWeight: number;
  okMaxWeight: number;

  goodMinLength: number;
  goodMaxLength: number;
  okMinLength: number;
  okMaxLength: number;

  goodMinDensity: number;
  goodMaxDensity: number;
  okMinDensity: number;
  okMaxDensity: number;

  goodMinRamStrokes: number;
  goodMaxRamStrokes: number;
  okMinRamStrokes: number;
  okMaxRamStrokes: number;

  maxGoodHighPressure: number;
  maxOkHighPressure: number;

  maxGoodChannelPressure: number;
  maxOkChannelPressure: number;

  maxGoodTotalTime: number;
  maxOkTotalTime: number;
};

export type BaleQualityResult = {
  status: QualityStatus;
  score: number;
  reasons: string[];
  densityKgM3: number;
};

export const DEFAULT_QUALITY_RULES: Record<string, QualityRules> = {
  KARTON: {
    materialName: "KARTON",

    goodMinWeight: 650,
    goodMaxWeight: 800,
    okMinWeight: 600,
    okMaxWeight: 850,

    goodMinLength: 1100,
    goodMaxLength: 1300,
    okMinLength: 1050,
    okMaxLength: 1350,

    goodMinDensity: 430,
    goodMaxDensity: 570,
    okMinDensity: 380,
    okMaxDensity: 650,

    goodMinRamStrokes: 4,
    goodMaxRamStrokes: 9,
    okMinRamStrokes: 3,
    okMaxRamStrokes: 12,

    maxGoodHighPressure: 900,
    maxOkHighPressure: 1100,

    maxGoodChannelPressure: 2200,
    maxOkChannelPressure: 2600,

    maxGoodTotalTime: 450,
    maxOkTotalTime: 650,
  },

  DEFAULT: {
    materialName: "DEFAULT",

    goodMinWeight: 500,
    goodMaxWeight: 900,
    okMinWeight: 400,
    okMaxWeight: 1000,

    goodMinLength: 1050,
    goodMaxLength: 1350,
    okMinLength: 950,
    okMaxLength: 1450,

    goodMinDensity: 350,
    goodMaxDensity: 700,
    okMinDensity: 250,
    okMaxDensity: 850,

    goodMinRamStrokes: 3,
    goodMaxRamStrokes: 10,
    okMinRamStrokes: 2,
    okMaxRamStrokes: 14,

    maxGoodHighPressure: 1000,
    maxOkHighPressure: 1300,

    maxGoodChannelPressure: 2400,
    maxOkChannelPressure: 2800,

    maxGoodTotalTime: 500,
    maxOkTotalTime: 750,
  },
};

const STORAGE_KEY = "bollegraaf_bale_quality_rules_v1";

function normalizeMaterial(materialName?: string) {
  return materialName && materialName.trim() !== ""
    ? materialName.trim().toUpperCase()
    : "DEFAULT";
}

function getStoredRules(): Record<string, QualityRules> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getQualityRules(materialName?: string): QualityRules {
  const key = normalizeMaterial(materialName);
  const stored = getStoredRules();

  return (
    stored[key] ??
    DEFAULT_QUALITY_RULES[key] ??
    DEFAULT_QUALITY_RULES.DEFAULT
  );
}

export function saveQualityRules(materialName: string, rules: QualityRules) {
  const key = normalizeMaterial(materialName);
  const stored = getStoredRules();

  stored[key] = {
    ...rules,
    materialName: key,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function resetQualityRules(materialName: string) {
  const key = normalizeMaterial(materialName);
  const stored = getStoredRules();

  delete stored[key];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function scoreRange(
  value: number,
  goodMin: number,
  goodMax: number,
  okMin: number,
  okMax: number,
  label: string,
  reasons: string[]
) {
  if (!Number.isFinite(value) || value <= 0) {
    reasons.push(`${label} missing`);
    return 0;
  }

  if (value >= goodMin && value <= goodMax) {
    return 100;
  }

  if (value >= okMin && value <= okMax) {
    reasons.push(`${label} outside good range`);
    return 70;
  }

  reasons.push(`${label} outside allowed range`);
  return 30;
}

function scoreMax(
  value: number | undefined,
  goodMax: number,
  okMax: number,
  label: string,
  reasons: string[]
) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    return 100;
  }

  const v = Number(value);

  if (v <= goodMax) {
    return 100;
  }

  if (v <= okMax) {
    reasons.push(`${label} high`);
    return 70;
  }

  reasons.push(`${label} too high`);
  return 30;
}

function statusFromScore(score: number): QualityStatus {
  if (score >= 90) return "GOOD";
  if (score >= 72) return "OK";
  return "WARNING";
}

export function calculateBaleQuality(
  bale: BaleQualityInput,
  rulesOverride?: QualityRules
): BaleQualityResult {
  if (!bale || !bale.materialName) {
    return {
      status: "UNKNOWN",
      score: 0,
      reasons: ["No bale data"],
      densityKgM3: 0,
    };
  }

  const rules = rulesOverride ?? getQualityRules(bale.materialName);
  const reasons: string[] = [];

  const volumeM3 = Number(bale.volume || 0) / 1000;
  const densityKgM3 =
    volumeM3 > 0 ? Number(bale.weight || 0) / volumeM3 : 0;

  const scores = [
    scoreRange(
      Number(bale.weight || 0),
      rules.goodMinWeight,
      rules.goodMaxWeight,
      rules.okMinWeight,
      rules.okMaxWeight,
      "Weight",
      reasons
    ),

    scoreRange(
      Number(bale.baleLength || 0),
      rules.goodMinLength,
      rules.goodMaxLength,
      rules.okMinLength,
      rules.okMaxLength,
      "Length",
      reasons
    ),

    scoreRange(
      densityKgM3,
      rules.goodMinDensity,
      rules.goodMaxDensity,
      rules.okMinDensity,
      rules.okMaxDensity,
      "Density",
      reasons
    ),

    scoreMax(
      Number(bale.totalTime || 0),
      rules.maxGoodTotalTime,
      rules.maxOkTotalTime,
      "Total time",
      reasons
    ),

    scoreMax(
      bale.maxHighPressure,
      rules.maxGoodHighPressure,
      rules.maxOkHighPressure,
      "High pressure",
      reasons
    ),

    scoreMax(
      bale.maxChannelPressure,
      rules.maxGoodChannelPressure,
      rules.maxOkChannelPressure,
      "Channel pressure",
      reasons
    ),
  ];

  if (Number.isFinite(Number(bale.ramStrokes)) && Number(bale.ramStrokes) > 0) {
    scores.push(
      scoreRange(
        Number(bale.ramStrokes),
        rules.goodMinRamStrokes,
        rules.goodMaxRamStrokes,
        rules.okMinRamStrokes,
        rules.okMaxRamStrokes,
        "Ram strokes",
        reasons
      )
    );
  }

  const score = Math.round(
    scores.reduce((sum, value) => sum + value, 0) / scores.length
  );

  return {
    status: statusFromScore(score),
    score,
    reasons,
    densityKgM3,
  };
}

export function summarizeBaleQuality(bales: BaleQualityInput[]) {
  const summary = {
    GOOD: 0,
    OK: 0,
    WARNING: 0,
    UNKNOWN: 0,
  };

  for (const bale of bales) {
    const result = calculateBaleQuality(bale);
    summary[result.status] += 1;
  }

  return summary;
}

export function getQualityBadgeClass(status: QualityStatus) {
  if (status === "GOOD") {
    return "bg-green-100 text-green-800 border-green-300";
  }

  if (status === "OK") {
    return "bg-blue-100 text-blue-800 border-blue-300";
  }

  if (status === "WARNING") {
    return "bg-orange-100 text-orange-800 border-orange-300";
  }

  return "bg-slate-100 text-slate-700 border-slate-300";
}