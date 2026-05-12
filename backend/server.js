import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST || "host.docker.internal",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "BalerDB",
});

app.get("/api/overview", async (req, res) => {
  try {
    const [latestRows] = await db.query(`
      SELECT *
      FROM BaleData
      ORDER BY id DESC
      LIMIT 1
    `);

    const [statsRows] = await db.query(`
      SELECT
        COUNT(*) AS total_bales,
        COALESCE(SUM(kwh_used), 0) AS total_kwh,
        COALESCE(AVG(weight), 0) AS avg_weight,
        COALESCE(AVG(volume), 0) AS avg_volume,
        COALESCE(AVG(bale_length), 0) AS avg_bale_length,
        COALESCE(AVG(oil_temperature), 0) AS avg_oil_temperature,
        COALESCE(AVG(total_time), 0) AS avg_total_time,
        COALESCE(SUM(total_time), 0) AS sum_total_time,
        COALESCE(SUM(auto_time), 0) AS sum_auto_time,
        COALESCE(SUM(standby_time), 0) AS sum_standby_time,
        COALESCE(SUM(empty_time), 0) AS sum_empty_time
      FROM BaleData
    `);

    const [materials] = await db.query(`
      SELECT
        material_name,
        COUNT(*) AS count,
        COALESCE(AVG(weight), 0) AS avg_weight,
        COALESCE(SUM(weight), 0) AS total_weight,
        COALESCE(AVG(bale_length), 0) AS avg_length,
        COALESCE(SUM(bale_length), 0) AS total_length,
        COALESCE(AVG(kwh_used), 0) AS avg_kwh,
        COALESCE(SUM(kwh_used), 0) AS total_kwh,
        COALESCE(AVG(total_time), 0) AS avg_total_time,
        COALESCE(SUM(total_time), 0) AS total_total_time,
        COALESCE(AVG(auto_time), 0) AS avg_auto_time,
        COALESCE(SUM(auto_time), 0) AS total_auto_time,
        COALESCE(AVG(standby_time), 0) AS avg_standby_time,
        COALESCE(SUM(standby_time), 0) AS total_standby_time,
        COALESCE(AVG(empty_time), 0) AS avg_empty_time,
        COALESCE(SUM(empty_time), 0) AS total_empty_time
      FROM BaleData
      GROUP BY material_name
      ORDER BY count DESC
    `);

    const [baleOptions] = await db.query(`
      SELECT *
      FROM BaleData
      ORDER BY id DESC
      LIMIT 100
    `);

    res.json({
      latest: latestRows[0] || null,
      stats: statsRows[0] || null,
      materials,
      recent24h: statsRows[0]?.total_bales || 0,
      filters: {
        materials: [...new Set(baleOptions.map((b) => b.material_name).filter(Boolean))],
        recipes: [...new Set(baleOptions.map((b) => b.recipe_number).filter(Boolean))],
      },
      baleOptions,
      timeline: {
        bucket: "day",
        rows: [],
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/bales", async (req, res) => {
  const [rows] = await db.query(`SELECT * FROM BaleData ORDER BY id DESC LIMIT 200`);
  res.json({ data: rows, pagination: { page: 1, limit: 200, total: rows.length, totalPages: 1 } });
});

app.get("/api/bales/:id", async (req, res) => {
  const [rows] = await db.query(`SELECT * FROM BaleData WHERE id = ?`, [req.params.id]);
  res.json(rows[0] || null);
});

app.get("/api/cycles/:baleId", async (req, res) => {
  const [rows] = await db.query(`SELECT * FROM CycleTimes WHERE bale_id = ? ORDER BY id ASC`, [req.params.baleId]);
  res.json({ cycles: rows });
});

app.get("/api/pressure/:baleId", async (req, res) => {
  const [rows] = await db.query(`SELECT * FROM ChannelPressure WHERE bale_id = ? ORDER BY id ASC`, [req.params.baleId]);
  res.json({ pressure: rows });
});

app.get("/api/events", (req, res) => {
  res.json({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } });
});

app.get("/api/raw", (req, res) => {
  res.json({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } });
});

app.listen(3001, () => console.log("API running on 3001"));