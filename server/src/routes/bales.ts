import { Router } from "express";
import pool from "../db.js";

export const balesRouter = Router();

balesRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const sort = (req.query.sort as string) || "timestamp";
    const order = (req.query.order as string)?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const allowedSorts = [
      "timestamp",
      "bale_number",
      "material_name",
      "recipe_number",
      "weight",
      "volume",
      "bale_length",
      "total_time",
      "kwh_used",
      "shift_number",
    ];

    const sortCol = allowedSorts.includes(sort) ? sort : "timestamp";

    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.material) {
      conditions.push("material_name = ?");
      params.push(req.query.material);
    }

    if (req.query.bale_number) {
      conditions.push("bale_number = ?");
      params.push(Number(req.query.bale_number));
    }

    if (req.query.from) {
      conditions.push("timestamp >= ?");
      params.push(req.query.from);
    }

    if (req.query.to) {
      conditions.push("timestamp <= ?");
      params.push(req.query.to);
    }

    if (req.query.shift) {
      conditions.push("shift_number = ?");
      params.push(Number(req.query.shift));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRows]: any = await pool.query(
      `SELECT COUNT(*) as total FROM BaleData ${where}`,
      params
    );

    const total = countRows[0].total;

    const [rows]: any = await pool.query(
      `
      SELECT
        id,
        timestamp as ts,
        bale_number,
        material_name,
        recipe_number,
        shift_number,
        weight,
        volume,
        bale_length,
        total_time,
        auto_time,
        standby_time,
        empty_time,
        kwh_used,
        oil_temperature,
        oil_level,
        username,
        id as raw_id
      FROM BaleData
      ${where}
      ORDER BY ${sortCol} ${order}
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [materials]: any = await pool.query(`
      SELECT DISTINCT material_name
      FROM BaleData
      WHERE material_name IS NOT NULL AND material_name <> ''
      ORDER BY material_name
    `);

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        materials: materials.map((m: any) => m.material_name),
      },
    });
  } catch (err: any) {
    console.error("Bales list error:", err);
    res.status(500).json({ error: err.message });
  }
});

balesRouter.get("/:id", async (req, res) => {
  try {
    const [baleRows]: any = await pool.query(
      `
    SELECT
      *,
      timestamp as ts,
      id as raw_id
      FROM BaleData
      WHERE id = ?
      `,
      [req.params.id]
    );

    if (!baleRows.length) {
      return res.status(404).json({ error: "Bale not found" });
    }

    res.json({
      ...baleRows[0],
      parsedPayload: null,
    });
  } catch (err: any) {
    console.error("Bale detail error:", err);
    res.status(500).json({ error: err.message });
  }
});