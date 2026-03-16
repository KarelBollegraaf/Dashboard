import { Router } from "express";
import pool from "../db.js";

export const overviewRouter = Router();

function countNonZero(values: unknown): number {
  if (!Array.isArray(values)) return 0;
  return values.filter((v) => Number(v) > 0).length;
}

overviewRouter.get("/", async (req, res) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : null;
    const to = typeof req.query.to === "string" ? req.query.to : null;

    const [latestRows]: any = await pool.query(
      `
      SELECT *
      FROM bale_cycle
      WHERE (? IS NULL OR ts >= ?)
        AND (? IS NULL OR ts <= ?)
      ORDER BY ts DESC, id DESC
      LIMIT 1
      `,
      [from, from, to, to]
    );

    const [statsRows]: any = await pool.query(
      `
      SELECT
        COUNT(*) as total_bales,
        COALESCE(SUM(kwh_used), 0) as total_kwh,
        COALESCE(AVG(weight), 0) as avg_weight,
        COALESCE(AVG(volume), 0) as avg_volume,
        COALESCE(AVG(bale_length), 0) as avg_bale_length,
        COALESCE(AVG(oil_temperature), 0) as avg_oil_temperature,
        COALESCE(AVG(total_time), 0) as avg_total_time,
        COALESCE(SUM(total_time), 0) as sum_total_time,
        COALESCE(SUM(auto_time), 0) as sum_auto_time,
        COALESCE(SUM(standby_time), 0) as sum_standby_time,
        COALESCE(SUM(empty_time), 0) as sum_empty_time
      FROM bale_cycle
      WHERE (? IS NULL OR ts >= ?)
        AND (? IS NULL OR ts <= ?)
      `,
      [from, from, to, to]
    );

    const [materialRows]: any = await pool.query(
      `
      SELECT
        bc.material_name,
        COUNT(*) as count,

        COALESCE(AVG(bc.weight), 0) as avg_weight,
        COALESCE(SUM(bc.weight), 0) as total_weight,

        COALESCE(AVG(bc.bale_length), 0) as avg_length,
        COALESCE(SUM(bc.bale_length), 0) as total_length,

        COALESCE(AVG(bc.kwh_used), 0) as avg_kwh,
        COALESCE(SUM(bc.kwh_used), 0) as total_kwh,

        COALESCE(AVG(bc.total_time), 0) as avg_total_time,
        COALESCE(SUM(bc.total_time), 0) as total_total_time,

        COALESCE(AVG(bc.auto_time), 0) as avg_auto_time,
        COALESCE(SUM(bc.auto_time), 0) as total_auto_time,

        COALESCE(AVG(bc.standby_time), 0) as avg_standby_time,
        COALESCE(SUM(bc.standby_time), 0) as total_standby_time,

        COALESCE(AVG(bc.empty_time), 0) as avg_empty_time,
        COALESCE(SUM(bc.empty_time), 0) as total_empty_time,

        GROUP_CONCAT(DISTINCT NULLIF(bc.username, '') ORDER BY bc.username SEPARATOR ', ') as operators
      FROM bale_cycle bc
      WHERE (? IS NULL OR bc.ts >= ?)
        AND (? IS NULL OR bc.ts <= ?)
      GROUP BY bc.material_name
      ORDER BY count DESC
      `,
      [from, from, to, to]
    );

    const [ramRows]: any = await pool.query(
      `
      SELECT
        bc.material_name,
        mr.payload
      FROM bale_cycle bc
      LEFT JOIN mqtt_raw mr ON mr.id = bc.raw_id
      WHERE (? IS NULL OR bc.ts >= ?)
        AND (? IS NULL OR bc.ts <= ?)
        AND bc.material_name IS NOT NULL
      `,
      [from, from, to, to]
    );

    const ramByMaterial = new Map<string, { total: number; count: number }>();

    for (const row of ramRows as any[]) {
      const material = row.material_name;
      if (!material) continue;

      let payload: any = row.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = null;
        }
      }

      const cycles = Array.isArray(payload?.cycles) ? payload.cycles : [];
      const ramForward = cycles.find(
        (c: any) => Array.isArray(c) && Number(c[0]) === 1 && Number(c[1]) === 1
      );

      const movementCount = ramForward ? countNonZero(ramForward[2]) : 0;

      const current = ramByMaterial.get(material) ?? { total: 0, count: 0 };
      current.total += movementCount;
      current.count += 1;
      ramByMaterial.set(material, current);
    }

    const enrichedMaterials = (materialRows || []).map((m: any) => {
      const ram = ramByMaterial.get(m.material_name) ?? { total: 0, count: 0 };

      return {
        ...m,
        avg_ram_forwards: ram.count > 0 ? ram.total / ram.count : 0,
        total_ram_forwards: ram.total,
        operators: m.operators || "—",
      };
    });

    const [recent24h]: any = await pool.query(`
      SELECT COUNT(*) as count
      FROM bale_cycle
      WHERE ts >= NOW() - INTERVAL 24 HOUR
    `);

    res.json({
      latest: latestRows[0] || null,
      stats: statsRows[0] || null,
      materials: enrichedMaterials,
      recent24h: recent24h[0]?.count || 0,
    });
  } catch (err: any) {
    console.error("Overview error:", err);
    res.status(500).json({ error: err.message });
  }
});