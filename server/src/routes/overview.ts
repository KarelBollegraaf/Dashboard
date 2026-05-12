import { Router } from "express";
import pool from "../db.js";

export const overviewRouter = Router();

function getBucket(from: string | null, to: string | null) {
  if (!from || !to) return "day";

  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 2) return "hour";
  if (diffDays <= 45) return "day";
  if (diffDays <= 400) return "week";
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
      conditions.push("bc.timestamp >= ?");
      params.push(from);
    }

    if (to) {
      conditions.push("bc.timestamp <= ?");
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
      SELECT bc.*, bc.timestamp as ts
      FROM BaleData bc
      ${where}
      ORDER BY bc.timestamp DESC, bc.id DESC
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
      FROM BaleData bc
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
      FROM BaleData bc
      ${where}
      GROUP BY bc.material_name
      ORDER BY count DESC
      `,
      params
    );

    const enrichedMaterials = (materialRows || []).map((m: any) => ({
      ...m,
      avg_ram_forwards: 0,
      total_ram_forwards: 0,
      operators: m.operators || "—",
    }));

    const [materialOptions]: any = await pool.query(`
      SELECT DISTINCT material_name
      FROM BaleData
      WHERE material_name IS NOT NULL AND material_name <> ''
      ORDER BY material_name
    `);

    const [recipeOptions]: any = await pool.query(`
      SELECT DISTINCT recipe_number
      FROM BaleData
      WHERE recipe_number IS NOT NULL
      ORDER BY recipe_number
    `);

    const [baleRows]: any = await pool.query(
      `
      SELECT
        bc.id,
        bc.timestamp as ts, 
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
        bc.id as raw_id
      FROM BaleData bc
      ${where}
      ORDER BY bc.timestamp DESC, bc.id DESC
      LIMIT 250
      `,
      params
    );

    const bucket = getBucket(from, to);

    const bucketExpr =
      bucket === "hour"
        ? "DATE_FORMAT(bc.timestamp, '%Y-%m-%d %H:00:00')"
        : bucket === "day"
        ? "DATE_FORMAT(bc.timestamp, '%Y-%m-%d')"
        : bucket === "week"
        ? "DATE_FORMAT(DATE_SUB(bc.timestamp, INTERVAL WEEKDAY(bc.timestamp) DAY), '%Y-%m-%d')"
        : "DATE_FORMAT(bc.timestamp, '%Y-%m-01')";

    const [timelineRows]: any = await pool.query(
      `
      SELECT
        ${bucketExpr} as bucket,
        bc.material_name,
        COUNT(*) as bale_count
      FROM BaleData bc
      ${where}
      GROUP BY bucket, bc.material_name
      ORDER BY bucket ASC, bc.material_name ASC
      `,
      params
    );

    const [recent24h]: any = await pool.query(`
      SELECT COUNT(*) as count
      FROM BaleData
      WHERE timestamp >= NOW() - INTERVAL 24 HOUR
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