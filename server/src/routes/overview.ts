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

function toNumberArray(value: any): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter(Number.isFinite);
      }
    } catch {
      const n = Number(value);
      return Number.isFinite(n) ? [n] : [];
    }
  }

  const n = Number(value);
  return Number.isFinite(n) ? [n] : [];
}

function maxNonZero(value: any): number {
  const values = toNumberArray(value).filter((v) => v > 0);
  return values.length > 0 ? Math.max(...values) : 0;
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
        COALESCE(AVG(bc.oil_level), 0) as avg_oil_level,
        COALESCE(AVG(bc.knots_vertical), 0) as avg_knots_vertical,
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
        COALESCE(AVG(bc.volume), 0) as avg_volume,
        COALESCE(SUM(bc.volume), 0) as total_volume,
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
        COALESCE(AVG(bc.oil_temperature), 0) as avg_oil_temperature,
        COALESCE(AVG(bc.oil_level), 0) as avg_oil_level,
        COALESCE(AVG(bc.knots_vertical), 0) as avg_knots_vertical,
        GROUP_CONCAT(DISTINCT NULLIF(bc.username, '') ORDER BY bc.username SEPARATOR ', ') as operators
      FROM BaleData bc
      ${where}
      GROUP BY bc.material_name
      ORDER BY count DESC
      `,
      params
    );

    const [pressureRows]: any = await pool.query(
      `
      SELECT
        bc.id as bale_id,
        bc.material_name,
        cp.high_pressure,
        cp.channel_pressure
      FROM BaleData bc
      LEFT JOIN ChannelPressure cp
        ON cp.bale_id = bc.id
      ${where}
      `,
      params
    );

    const pressureByBale = new Map<
      number,
      {
        materialName: string;
        highMax: number;
        channelMax: number;
      }
    >();

    for (const row of pressureRows || []) {
      const baleId = Number(row.bale_id);
      const materialName = row.material_name || "Unknown";

      if (!pressureByBale.has(baleId)) {
        pressureByBale.set(baleId, {
          materialName,
          highMax: 0,
          channelMax: 0,
        });
      }

      const item = pressureByBale.get(baleId)!;

      item.highMax = Math.max(item.highMax, maxNonZero(row.high_pressure));
      item.channelMax = Math.max(item.channelMax, maxNonZero(row.channel_pressure));
    }

    const pressureByMaterial = new Map<
      string,
      {
        highSum: number;
        channelSum: number;
      }
    >();

    for (const item of pressureByBale.values()) {
      if (!pressureByMaterial.has(item.materialName)) {
        pressureByMaterial.set(item.materialName, {
          highSum: 0,
          channelSum: 0,
        });
      }

      const materialPressure = pressureByMaterial.get(item.materialName)!;
      materialPressure.highSum += item.highMax;
      materialPressure.channelSum += item.channelMax;
    }

    const [ramRows]: any = await pool.query(
      `
      SELECT
        bc.material_name,
        COUNT(ct.id) as total_ram_forwards
      FROM BaleData bc
      LEFT JOIN CycleTimes ct
        ON ct.bale_id = bc.id
        AND ct.part = 1
        AND ct.direction = 1
      ${where}
      GROUP BY bc.material_name
      `,
      params
    );

    const ramByMaterial = new Map<string, number>();

    for (const row of ramRows || []) {
      ramByMaterial.set(row.material_name, Number(row.total_ram_forwards ?? 0));
    }

    const enrichedMaterials = (materialRows || []).map((m: any) => {
      const baleCount = Number(m.count ?? 0);
      const totalRamForwards = ramByMaterial.get(m.material_name) ?? 0;
      const pressure = pressureByMaterial.get(m.material_name) ?? {
        highSum: 0,
        channelSum: 0,
      };

      return {
        ...m,
        total_ram_forwards: totalRamForwards,
        avg_ram_forwards: baleCount > 0 ? totalRamForwards / baleCount : 0,
        avg_high_pressure: baleCount > 0 ? pressure.highSum / baleCount : 0,
        avg_channel_pressure: baleCount > 0 ? pressure.channelSum / baleCount : 0,
        operators: m.operators || "—",
      };
    });

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
        COUNT(*) as bale_count,
        COALESCE(SUM(bc.total_time), 0) as sum_total_time,
        COALESCE(SUM(bc.auto_time), 0) as sum_auto_time,
        COALESCE(SUM(bc.standby_time), 0) as sum_standby_time,
        COALESCE(SUM(bc.empty_time), 0) as sum_empty_time
      FROM BaleData bc
      ${where}
      GROUP BY bucket, bc.material_name
      ORDER BY bucket ASC, bc.material_name ASC
      `,
      params
    );

    const recent24hEnd = to ? new Date(to) : new Date();
    const recent24hStart = new Date(recent24hEnd);
    recent24hStart.setHours(recent24hEnd.getHours() - 24);

    const recent24hConditions: string[] = [
      "bc.timestamp >= ?",
      "bc.timestamp <= ?",
    ];

    const recent24hParams: any[] = [
      recent24hStart.toISOString(),
      recent24hEnd.toISOString(),
    ];

    if (materials.length > 0) {
      recent24hConditions.push(
        `bc.material_name IN (${materials.map(() => "?").join(",")})`
      );
      recent24hParams.push(...materials);
    }

    if (recipes.length > 0) {
      recent24hConditions.push(
        `bc.recipe_number IN (${recipes.map(() => "?").join(",")})`
      );
      recent24hParams.push(...recipes);
    }

    const [recent24h]: any = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM BaleData bc
      WHERE ${recent24hConditions.join(" AND ")}
      `,
      recent24hParams
    );

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