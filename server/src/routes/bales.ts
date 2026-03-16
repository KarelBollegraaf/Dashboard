import { Router } from "express";
import pool from "../db.js";

export const balesRouter = Router();

// List bales with pagination, sorting, filtering
balesRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const sort = (req.query.sort as string) || "ts";
    const order = (req.query.order as string)?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const allowedSorts = [
      "ts", "bale_number", "material_name", "recipe_number",
      "weight", "volume", "bale_length", "total_time", "kwh_used", "shift_number"
    ];
    const sortCol = allowedSorts.includes(sort) ? sort : "ts";

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
      conditions.push("ts >= ?");
      params.push(req.query.from);
    }
    if (req.query.to) {
      conditions.push("ts <= ?");
      params.push(req.query.to);
    }
    if (req.query.shift) {
      conditions.push("shift_number = ?");
      params.push(Number(req.query.shift));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRows]: any = await pool.query(
      `SELECT COUNT(*) as total FROM bale_cycle ${where}`, params
    );
    const total = countRows[0].total;

    const [rows]: any = await pool.query(
      `SELECT id, ts, bale_number, material_name, recipe_number, shift_number,
              weight, volume, bale_length, total_time, auto_time, standby_time,
              empty_time, kwh_used, oil_temperature, oil_level, username, raw_id
       FROM bale_cycle ${where}
       ORDER BY ${sortCol} ${order}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get distinct materials for filter dropdown
    const [materials]: any = await pool.query(
      `SELECT DISTINCT material_name FROM bale_cycle ORDER BY material_name`
    );

    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { materials: materials.map((m: any) => m.material_name) },
    });
  } catch (err: any) {
    console.error("Bales list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Single bale detail with joined raw data
balesRouter.get("/:id", async (req, res) => {
  try {
    const [baleRows]: any = await pool.query(
      `SELECT bc.*, mr.payload, mr.payload_text, mr.topic, mr.ts as raw_ts
       FROM bale_cycle bc
       LEFT JOIN mqtt_raw mr ON bc.raw_id = mr.id
       WHERE bc.id = ?`,
      [req.params.id]
    );

    if (!baleRows.length) {
      return res.status(404).json({ error: "Bale not found" });
    }

    const bale = baleRows[0];

    // Parse payload JSON
    let parsedPayload = null;
    try {
      const payloadStr = bale.payload_text || (bale.payload ? bale.payload.toString() : null);
      if (payloadStr) {
        parsedPayload = JSON.parse(payloadStr);
      }
    } catch { /* payload not valid JSON */ }

    res.json({
      ...bale,
      payload: undefined,
      payload_text: undefined,
      parsedPayload,
    });
  } catch (err: any) {
    console.error("Bale detail error:", err);
    res.status(500).json({ error: err.message });
  }
});
