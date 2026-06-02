import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { overviewRouter } from "./routes/overview.js";
import { balesRouter } from "./routes/bales.js";
import { rawRouter } from "./routes/raw.js";
import { eventsRouter } from "./routes/events.js";
import { cyclesRouter } from "./routes/cycles.js";
import { pressureRouter } from "./routes/pressure.js";
import latestBaleRouter from "./routes/latest-bale.js";

const app = express();
const PORT = Number(process.env.API_PORT) || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/overview", overviewRouter);
app.use("/api/bales", balesRouter);
app.use("/api/raw", rawRouter);
app.use("/api/events", eventsRouter);
app.use("/api/cycles", cyclesRouter);
app.use("/api/pressure", pressureRouter);
app.use("/api/latest-bale", latestBaleRouter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    dbHost: process.env.DB_HOST || "localhost",
    dbPort: Number(process.env.DB_PORT) || 3306,
    dbName: process.env.DB_NAME || "BalerDB",
  });
});

// Frontend dist folder from Docker production layout:
// /app/server/dist/index.js
// /app/frontend/dist
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

app.use(express.static(frontendDist));

// React Router fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }

  res.sendFile(path.join(frontendDist, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bollegraaf dashboard running on http://0.0.0.0:${PORT}`);
});