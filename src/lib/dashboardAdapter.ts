type OverviewApi = {
  latest?: any;
  stats?: any;
  materials?: any[];
  recent24h?: number;
};

export function adaptOverview(data: OverviewApi | null | undefined) {
  const latest = data?.latest ?? null;
  const stats = data?.stats ?? null;
  const materials = Array.isArray(data?.materials) ? data!.materials : [];

  return {
    latest: latest
      ? {
          id: Number(latest.id ?? 0),
          ts: latest.ts ?? "",
          baleNumber: Number(latest.bale_number ?? 0),
          recipeNumber: Number(latest.recipe_number ?? 0),
          materialName: latest.material_name ?? "Unknown",
          userId: Number(latest.user_id ?? 0),
          username: latest.username ?? "",
          customerNumber: Number(latest.customer_number ?? 0),
          shiftNumber: Number(latest.shift_number ?? 0),
          kwhUsed: Number(latest.kwh_used ?? 0),
          baleLength: Number(latest.bale_length ?? 0),
          wiresVertical: Number(latest.wires_vertical ?? 0),
          wiresHorizontal: Number(latest.wires_horizontal ?? 0),
          knotsVertical: Number(latest.knots_vertical ?? 0),
          knotsHorizontal: Number(latest.knots_horizontal ?? 0),
          weight: Number(latest.weight ?? 0),
          volume: Number(latest.volume ?? 0),
          oilTemperature: Number(latest.oil_temperature ?? 0),
          oilLevel: Number(latest.oil_level ?? 0),
          totalTime: Number(latest.total_time ?? 0),
          autoTime: Number(latest.auto_time ?? 0),
          standbyTime: Number(latest.standby_time ?? 0),
          emptyTime: Number(latest.empty_time ?? 0),
          valveLp: Number(latest.valve_lp ?? 0),
          valveHp: Number(latest.valve_hp ?? 0),
          valveKo1: Number(latest.valve_ko1 ?? 0),
          valveKo2: Number(latest.valve_ko2 ?? 0),
          valveKd1: Number(latest.valve_kd1 ?? 0),
          valveKd2: Number(latest.valve_kd2 ?? 0),
          valveRp1: Number(latest.valve_rp1 ?? 0),
          valveRp2: Number(latest.valve_rp2 ?? 0),
          valveRr1: Number(latest.valve_rr1 ?? 0),
          valveRr2: Number(latest.valve_rr2 ?? 0),
          valveCh: Number(latest.valve_ch ?? 0),
          valveMes: Number(latest.valve_mes ?? 0),
          rawId: Number(latest.raw_id ?? 0),
        }
      : null,

    stats: {
      totalBales: Number(stats?.total_bales ?? 0),
      totalKwh: Number(stats?.total_kwh ?? 0),
      avgWeight: Number(stats?.avg_weight ?? 0),
      avgVolume: Number(stats?.avg_volume ?? 0),
      avgBaleLength: Number(stats?.avg_bale_length ?? 0),
      avgOilTemperature: Number(stats?.avg_oil_temperature ?? 0),
      avgTotalTime: Number(stats?.avg_total_time ?? 0),
      sumTotalTime: Number(stats?.sum_total_time ?? 0),
      sumAutoTime: Number(stats?.sum_auto_time ?? 0),
      sumStandbyTime: Number(stats?.sum_standby_time ?? 0),
      sumEmptyTime: Number(stats?.sum_empty_time ?? 0),
      recent24h: Number(data?.recent24h ?? 0),
    },

    materials: materials
      .filter((m) => m && m.material_name != null)
      .map((m) => ({
        materialName: m.material_name ?? "Unknown",
        count: Number(m.count ?? 0),

        avgWeight: Number(m.avg_weight ?? 0),
        totalWeight: Number(m.total_weight ?? 0),

        avgLength: Number(m.avg_length ?? 0),
        totalLength: Number(m.total_length ?? 0),

        avgKwh: Number(m.avg_kwh ?? 0),
        totalKwh: Number(m.total_kwh ?? 0),

        avgTotalTime: Number(m.avg_total_time ?? 0),
        totalTotalTime: Number(m.total_total_time ?? 0),

        avgAutoTime: Number(m.avg_auto_time ?? 0),
        totalAutoTime: Number(m.total_auto_time ?? 0),

        avgStandbyTime: Number(m.avg_standby_time ?? 0),
        totalStandbyTime: Number(m.total_standby_time ?? 0),

        avgEmptyTime: Number(m.avg_empty_time ?? 0),
        totalEmptyTime: Number(m.total_empty_time ?? 0),

        avgRamForwards: Number(m.avg_ram_forwards ?? 0),
        totalRamForwards: Number(m.total_ram_forwards ?? 0),

        operators: m.operators ?? "—",
      })),
  };
}