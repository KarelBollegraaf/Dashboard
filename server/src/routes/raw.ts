import { Router } from "express";
import pool from "../db.js";

export const rawRouter = Router();

rawRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [countRows]: any = await pool.query(`SELECT COUNT(*) as total FROM mqtt_raw`);
    const total = countRows[0].total;

    // Detect message type using JSON_EXTRACT
    const [rows]: any = await pool.query(`
      SELECT
        id, ts, topic,
        CASE
          WHEN JSON_VALID(payload_text) AND JSON_EXTRACT(payload_text, '$.EventIdentifier') IS NOT NULL THEN 'event'
          WHEN JSON_VALID(payload_text) AND JSON_EXTRACT(payload_text, '$.fields') IS NOT NULL THEN 'bale_data'
          ELSE 'unknown'
        END as message_type,
        LEFT(COALESCE(payload_text, ''), 200) as payload_preview
      FROM mqtt_raw
      ORDER BY ts DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    console.error("Raw list error:", err);
    res.status(500).json({ error: err.message });
  }
});

rawRouter.get("/:id", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, ts, topic, payload_text FROM mqtt_raw WHERE id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Raw message not found" });
    }

    const row = rows[0];
    let parsedPayload = null;
    try {
      if (row.payload_text) parsedPayload = JSON.parse(row.payload_text);
    } catch { /* not valid JSON */ }

    res.json({ ...row, parsedPayload });
  } catch (err: any) {
    console.error("Raw detail error:", err);
    res.status(500).json({ error: err.message });
  }
});
