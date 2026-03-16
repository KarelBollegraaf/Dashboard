import { Router } from "express";
import pool from "../db.js";

export const eventsRouter = Router();

eventsRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    // Count event messages
    const [countRows]: any = await pool.query(`
      SELECT COUNT(*) as total FROM mqtt_raw
      WHERE JSON_VALID(payload_text)
        AND JSON_EXTRACT(payload_text, '$.EventIdentifier') IS NOT NULL
    `);
    const total = countRows[0].total;

    const [rows]: any = await pool.query(`
      SELECT
        id, ts, topic,
        JSON_UNQUOTE(JSON_EXTRACT(payload_text, '$.EventIdentifier')) as event_identifier,
        JSON_EXTRACT(payload_text, '$.Bale_Ready') as bale_ready,
        JSON_EXTRACT(payload_text, '$.Bale_Click') as bale_click
      FROM mqtt_raw
      WHERE JSON_VALID(payload_text)
        AND JSON_EXTRACT(payload_text, '$.EventIdentifier') IS NOT NULL
      ORDER BY ts DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    console.error("Events error:", err);
    res.status(500).json({ error: err.message });
  }
});
