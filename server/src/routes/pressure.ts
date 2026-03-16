import { Router } from "express";
import pool from "../db.js";

export const pressureRouter = Router();

const PART_NAMES: Record<number, string> = {
  1: "Ram",
  2: "Flap",
  3: "NeedlesVertical",
  4: "NeedlesHorizontal",
  5: "KnotterVertical",
  6: "KnotterHorizontal",
  7: "Knife",
};

const DIRECTION_NAMES: Record<number, string> = {
  1: "Forward",
  2: "Reverse",
};

function cleanTrailingZeros(values: number[]): number[] {
  const cleaned = [...values];
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === 0) {
    cleaned.pop();
  }
  return cleaned;
}

pressureRouter.get("/:rawId", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT payload_text FROM mqtt_raw WHERE id = ?`,
      [req.params.rawId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Raw message not found" });
    }

    let payload: any;
    try {
      payload = JSON.parse(rows[0].payload_text);
    } catch {
      return res.status(400).json({ error: "Payload is not valid JSON" });
    }

    if (!payload.pressure || !Array.isArray(payload.pressure)) {
      return res.json({ pressure: [], message: "No pressure data in this message" });
    }

    const parsedPressure = payload.pressure.map((p: any) => {
      const partName = PART_NAMES[p.part] || `Part${p.part}`;
      const dirName = p.direction ? (DIRECTION_NAMES[p.direction] || `Dir${p.direction}`) : null;
      const label = dirName ? `${partName} ${dirName}` : partName;

      const highPressure = Array.isArray(p.high_pressure) ? cleanTrailingZeros(p.high_pressure) : [];
      const channelPressure = Array.isArray(p.channel_pressure) ? cleanTrailingZeros(p.channel_pressure) : [];

      const calcStats = (arr: number[]) => {
        const nonZero = arr.filter(v => v > 0);
        return {
          min: nonZero.length ? +Math.min(...nonZero).toFixed(2) : 0,
          max: nonZero.length ? +Math.max(...nonZero).toFixed(2) : 0,
          avg: nonZero.length ? +(nonZero.reduce((a, b) => a + b, 0) / nonZero.length).toFixed(2) : 0,
          count: nonZero.length,
        };
      };

      return {
        part: p.part,
        direction: p.direction,
        offset: p.offset,
        partName,
        directionName: dirName,
        label,
        highPressure,
        channelPressure,
        highPressureStats: calcStats(highPressure),
        channelPressureStats: calcStats(channelPressure),
      };
    });

    res.json({ pressure: parsedPressure });
  } catch (err: any) {
    console.error("Pressure error:", err);
    res.status(500).json({ error: err.message });
  }
});
