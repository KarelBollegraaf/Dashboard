import express from "express";
import cors from "cors";
import { overviewRouter } from "./routes/overview.js";
import { balesRouter } from "./routes/bales.js";
import { rawRouter } from "./routes/raw.js";
import { eventsRouter } from "./routes/events.js";
import { cyclesRouter } from "./routes/cycles.js";
import { pressureRouter } from "./routes/pressure.js";
import latestBaleRouter from "./routes/latest-bale.js";

const app = express();
const PORT = Number(process.env.API_PORT) || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/overview", overviewRouter);
app.use("/api/bales", balesRouter);
app.use("/api/raw", rawRouter);
app.use("/api/events", eventsRouter);
app.use("/api/cycles", cyclesRouter);
app.use("/api/pressure", pressureRouter);
app.use("/api/latest-bale", latestBaleRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bollegraaf API running on http://0.0.0.0:${PORT}`);
});