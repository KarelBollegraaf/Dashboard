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

function calcStats(arr: number[]) {
  const nonZero = arr.filter((v) => v > 0);
  return {
    min: nonZero.length ? +Math.min(...nonZero).toFixed(2) : 0,
    max: nonZero.length ? +Math.max(...nonZero).toFixed(2) : 0,
    avg: nonZero.length
      ? +(nonZero.reduce((a, b) => a + b, 0) / nonZero.length).toFixed(2)
      : 0,
    count: nonZero.length,
  };
}

function toNumberArray(value: any): number[] {
  if (Array.isArray(value)) return value.map(Number);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      const n = Number(value);
      return Number.isFinite(n) ? [n] : [];
    }
  }

  const n = Number(value);
  return Number.isFinite(n) ? [n] : [];
}

pressureRouter.get("/:baleId", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM ChannelPressure
      WHERE bale_id = ?
      ORDER BY id ASC
      `,
      [req.params.baleId]
    );

    const parsedPressure = rows.map((p: any) => {
      const part = Number(p.part ?? p.part_number ?? 1);
      const direction =
        p.direction === null || p.direction === undefined
          ? null
          : Number(p.direction);

      const partName = PART_NAMES[part] || `Part${part}`;
      const dirName = direction
        ? DIRECTION_NAMES[direction] || `Dir${direction}`
        : null;

      const label = dirName ? `${partName} ${dirName}` : partName;

      const highPressure = cleanTrailingZeros(
        toNumberArray(p.high_pressure ?? p.highPressure ?? p.hp ?? [])
      );

      const channelPressure = cleanTrailingZeros(
        toNumberArray(p.channel_pressure ?? p.channelPressure ?? p.pressure ?? [])
      );

      return {
        part,
        direction,
        offset: Number(p.offset ?? 0),
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