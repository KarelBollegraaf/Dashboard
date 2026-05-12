export interface Bale {
  id: string;
  timestamp: Date;
  recipeName: string;
  kwhBaling: number;
  kwhIdle: number;
  balingTime: number; // minutes
  idleTime: number; // minutes
  numberOfStrokes: number;
  channelPressureSetting: number; // percentage
  setPhotocellHeight: number; // cm
  setBaleLength: number; // cm
  measuredBaleLength: number; // cm
  numberOfWires: number;
  density: number; // kg/m³
  length: number; // cm - for backward compatibility
  width: number; // cm
  height: number; // cm
  weight: number; // kg
  quality: "excellent" | "good" | "acceptable";
}

export interface GeneralStats {
  operatingHours: number;
  totalKwh: number;
}

export interface MaterialCategory {
  name: string;
  recipes: string[];
  color: string;
}
