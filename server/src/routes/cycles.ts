import { Router } from "express";
import pool from "../db.js";

export const cyclesRouter = Router();

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

cyclesRouter.get("/:rawId", async (req, res) => {
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

    if (!payload.cycles || !Array.isArray(payload.cycles)) {
      return res.json({ cycles: [], message: "No cycle data in this message" });
    }

    const parsedCycles = payload.cycles.map((cycle: any) => {
      const [part, direction, values] = cycle;
      const partName = PART_NAMES[part] || `Part${part}`;
      const dirName = direction ? (DIRECTION_NAMES[direction] || `Dir${direction}`) : null;
      const label = dirName ? `${partName} ${dirName}` : partName;
      const cleanedValues = Array.isArray(values) ? cleanTrailingZeros(values) : [];

      const nonZero = cleanedValues.filter((v: number) => v > 0);
      const min = nonZero.length > 0 ? Math.min(...nonZero) : 0;
      const max = nonZero.length > 0 ? Math.max(...nonZero) : 0;
      const avg = nonZero.length > 0 ? nonZero.reduce((a: number, b: number) => a + b, 0) / nonZero.length : 0;

      return {
        part,
        direction,
        partName,
        directionName: dirName,
        label,
        values: cleanedValues,
        stats: { min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2), count: nonZero.length },
      };
    });

    res.json({ cycles: parsedCycles });
  } catch (err: any) {
    console.error("Cycles error:", err);
    res.status(500).json({ error: err.message });
  }
});
