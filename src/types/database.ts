// Database types matching the real BalerDB schema

export interface BaleCycle {
  id: number;
  ts: string;
  bale_number: number;
  recipe_number: number;
  material_name: string;
  user_id: number;
  username: string;
  customer_number: string;
  shift_number: number;
  kwh_used: number;
  bale_length: number;
  wires_vertical: number;
  wires_horizontal: number;
  knots_vertical: number;
  knots_horizontal: number;
  weight: number;
  volume: number;
  oil_temperature: number;
  oil_level: number;
  total_time: number;
  auto_time: number;
  standby_time: number;
  empty_time: number;
  valve_lp: number;
  valve_hp: number;
  valve_ko1: number;
  valve_ko2: number;
  valve_kd1: number;
  valve_kd2: number;
  valve_rp1: number;
  valve_rp2: number;
  valve_rr1: number;
  valve_rr2: number;
  valve_ch: number;
  valve_mes: number;
  raw_id: number;
}

export interface MqttRaw {
  id: number;
  ts: string;
  topic: string;
  payload_text: string;
  message_type?: "bale_data" | "event" | "unknown";
  payload_preview?: string;
  parsedPayload?: any;
}

export interface OverviewData {
  latest: BaleCycle | null;
  stats: {
    total_bales: number;
    total_kwh: number;
    avg_weight: number;
    avg_volume: number;
    avg_bale_length: number;
    avg_oil_temperature: number;
    avg_total_time: number;
    sum_total_time: number;
    sum_auto_time: number;
    sum_standby_time: number;
    sum_empty_time: number;
  } | null;
  materials: { material_name: string; count: number; avg_weight: number; avg_length: number }[];
  recent24h: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters?: {
    materials?: string[];
  };
}

export interface EventRecord {
  id: number;
  ts: string;
  topic: string;
  event_identifier: string;
  bale_ready: any;
  bale_click: any;
}

export interface ParsedCycle {
  part: number;
  direction: number | null;
  partName: string;
  directionName: string | null;
  label: string;
  values: number[];
  stats: { min: number; max: number; avg: number; count: number };
}

export interface ParsedPressure {
  part: number;
  direction: number | null;
  offset: number;
  partName: string;
  directionName: string | null;
  label: string;
  highPressure: number[];
  channelPressure: number[];
  highPressureStats: { min: number; max: number; avg: number; count: number };
  channelPressureStats: { min: number; max: number; avg: number; count: number };
}

export interface BaleDetail extends BaleCycle {
  topic?: string;
  raw_ts?: string;
  parsedPayload?: {
    fields?: Record<string, any>;
    cycles?: any[];
    pressure?: any[];
    [key: string]: any;
  };
}
