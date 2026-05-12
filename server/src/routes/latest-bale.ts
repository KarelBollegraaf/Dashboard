import { Router } from "express";
import pool from "../db.js";

const latestBaleRouter = Router();

latestBaleRouter.get("/", async (_req, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT *, timestamp as ts, id as raw_id
      FROM BaleData
      WHERE bale_number IS NOT NULL
      ORDER BY timestamp DESC, id DESC
      LIMIT 1
    `);

    res.json(rows[0] || null);
  } catch (err: any) {
    console.error("Latest bale error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default latestBaleRouter;