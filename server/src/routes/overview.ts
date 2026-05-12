import { Router } from "express";
import pool from "../db.js";

export const overviewRouter = Router();

function countNonZero(values: unknown): number {
  if (!Array.isArray(values)) return 0;
  return values.filter((v) => Number(v) > 0).length;
}

function getBucket(from: string | null, to: string | null) {
  if (!from || !to) return "day";

  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 2) return "hour";     // today / short range
  if (diffDays <= 45) return "day";     // week / month
  if (diffDays <= 400) return "week";   // year-ish
  return "month";
}

overviewRouter.get("/", async (req, res) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : null;
    const to = typeof req.query.to === "string" ? req.query.to : null;

    const materials =
      typeof req.query.materials === "string" && req.query.materials.trim() !== ""
        ? req.query.materials.split(",").map((v) => v.trim()).filter(Boolean)
        : [];

    const recipes =
      typeof req.query.recipes === "string" && req.query.recipes.trim() !== ""
        ? req.query.recipes
            .split(",")
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v))
        : [];

    const conditions: string[] = [];
    const params: any[] = [];

    if (from) {
      conditions.push("bc.ts >= ?");
      params.push(from);
    }

    if (to) {
      conditions.push("bc.ts <= ?");
      params.push(to);
    }

    if (materials.length > 0) {
      conditions.push(`bc.material_name IN (${materials.map(() => "?").join(",")})`);
      params.push(...materials);
    }

    if (recipes.length > 0) {
      conditions.push(`bc.recipe_number IN (${recipes.map(() => "?").join(",")})`);
      params.push(...recipes);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [latestRows]: any = await pool.query(
      `
      SELECT bc.*
      FROM bale_cycle bc
      ${where}
      ORDER BY bc.ts DESC, bc.id DESC
      LIMIT 1
      `,
      params
    );

    const [statsRows]: any = await pool.query(
      `
      SELECT
        COUNT(*) as total_bales,
        COALESCE(SUM(bc.kwh_used), 0) as total_kwh,
        COALESCE(AVG(bc.weight), 0) as avg_weight,
        COALESCE(AVG(bc.volume), 0) as avg_volume,
        COALESCE(AVG(bc.bale_length), 0) as avg_bale_length,
        COALESCE(AVG(bc.oil_temperature), 0) as avg_oil_temperature,
        COALESCE(AVG(bc.total_time), 0) as avg_total_time,
        COALESCE(SUM(bc.total_time), 0) as sum_total_time,
        COALESCE(SUM(bc.auto_time), 0) as sum_auto_time,
        COALESCE(SUM(bc.standby_time), 0) as sum_standby_time,
        COALESCE(SUM(bc.empty_time), 0) as sum_empty_time
      FROM bale_cycle bc
      ${where}
      `,
      params
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
      ${where}
      GROUP BY bc.material_name
      ORDER BY count DESC
      `,
      params
    );

    const [ramRows]: any = await pool.query(
      `
      SELECT bc.material_name, mr.payload
      FROM bale_cycle bc
      LEFT JOIN mqtt_raw mr ON mr.id = bc.raw_id
      ${where}
      AND bc.material_name IS NOT NULL
      `,
      params
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

    const [materialOptions]: any = await pool.query(`
      SELECT DISTINCT material_name
      FROM bale_cycle
      WHERE material_name IS NOT NULL AND material_name <> ''
      ORDER BY material_name
    `);

    const [recipeOptions]: any = await pool.query(`
      SELECT DISTINCT recipe_number
      FROM bale_cycle
      WHERE recipe_number IS NOT NULL
      ORDER BY recipe_number
    `);

    const [baleRows]: any = await pool.query(
      `
      SELECT
        bc.id,
        bc.ts,
        bc.bale_number,
        bc.material_name,
        bc.recipe_number,
        bc.shift_number,
        bc.weight,
        bc.volume,
        bc.bale_length,
        bc.total_time,
        bc.auto_time,
        bc.standby_time,
        bc.empty_time,
        bc.kwh_used,
        bc.oil_temperature,
        bc.oil_level,
        bc.knots_vertical,
        bc.customer_number,
        bc.raw_id
      FROM bale_cycle bc
      ${where}
      ORDER BY bc.ts DESC, bc.id DESC
      LIMIT 250
      `,
      params
    );

    const bucket = getBucket(from, to);

    const bucketExpr =
      bucket === "hour"
        ? "DATE_FORMAT(bc.ts, '%Y-%m-%d %H:00:00')"
        : bucket === "day"
        ? "DATE_FORMAT(bc.ts, '%Y-%m-%d')"
        : bucket === "week"
        ? "DATE_FORMAT(DATE_SUB(bc.ts, INTERVAL WEEKDAY(bc.ts) DAY), '%Y-%m-%d')"
        : "DATE_FORMAT(bc.ts, '%Y-%m-01')";

    const [timelineRows]: any = await pool.query(
      `
      SELECT
        ${bucketExpr} as bucket,
        bc.material_name,
        COUNT(*) as bale_count
      FROM bale_cycle bc
      ${where}
      GROUP BY bucket, bc.material_name
      ORDER BY bucket ASC, bc.material_name ASC
      `,
      params
    );

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
      filters: {
        materials: materialOptions.map((m: any) => m.material_name),
        recipes: recipeOptions.map((r: any) => Number(r.recipe_number)),
      },
      baleOptions: baleRows,
      timeline: {
        bucket,
        rows: timelineRows,
      },
    });
  } catch (err: any) {
    console.error("Overview error:", err);
    res.status(500).json({ error: err.message });
  }
});