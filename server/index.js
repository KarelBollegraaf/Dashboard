import crypto from "node:crypto";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

import { overviewRouter } from "./routes/overview.js";
import { balesRouter } from "./routes/bales.js";
import { rawRouter } from "./routes/raw.js";
import { eventsRouter } from "./routes/events.js";
import { cyclesRouter } from "./routes/cycles.js";
import { pressureRouter } from "./routes/pressure.js";
import latestBaleRouter from "./routes/latest-bale.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.API_PORT) || 3000;

const dashboardPublicUrl =
  process.env.DASHBOARD_PUBLIC_URL || `http://localhost:${PORT}`;

const resetTokens = new Map<
  string,
  {
    email: string;
    expiresAt: number;
  }
>();

const tokenLifetimeMs = 60 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getTransporter() {
  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASSWORD"),
    },
    requireTLS: true,
  });
}

function normalizeEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

function createResetToken(email: string) {
  const token = crypto.randomBytes(32).toString("hex");

  resetTokens.set(token, {
    email,
    expiresAt: Date.now() + tokenLifetimeMs,
  });

  return token;
}

function createResetLink(token: string) {
  const url = new URL("/reset-password", dashboardPublicUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from:
      process.env.MAIL_FROM ||
      "Bollegraaf Dashboard <s.edge@bollegraaf.com>",
    to,
    subject,
    text,
    html,
  });
}

async function sendPasswordResetEmail({
  email,
  name,
  isInvite = false,
}: {
  email: string;
  name?: string;
  isInvite?: boolean;
}) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const token = createResetToken(normalizedEmail);
  const resetLink = createResetLink(token);
  const greeting = name ? `Hello ${name},` : "Hello,";

  const subject = isInvite
    ? "Your Bollegraaf dashboard account"
    : "Reset your Bollegraaf dashboard password";

  const intro = isInvite
    ? "A dashboard account has been created for you. Use the link below to set your password."
    : "Use the link below to reset your dashboard password.";

  await sendMail({
    to: normalizedEmail,
    subject,
    text: `${greeting}

${intro}

${resetLink}

This link expires in 1 hour.

Bollegraaf Dashboard`,
    html: `
      <p>${greeting}</p>
      <p>${intro}</p>
      <p><a href="${resetLink}">Open password setup</a></p>
      <p>This link expires in 1 hour.</p>
      <p>Bollegraaf Dashboard</p>
    `,
  });
}

// Real dashboard API routes
app.use("/api/overview", overviewRouter);
app.use("/api/bales", balesRouter);
app.use("/api/raw", rawRouter);
app.use("/api/events", eventsRouter);
app.use("/api/cycles", cyclesRouter);
app.use("/api/pressure", pressureRouter);
app.use("/api/latest-bale", latestBaleRouter);

// Mail/login helper routes
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    dbHost: process.env.DB_HOST || "localhost",
    dbPort: Number(process.env.DB_PORT) || 3306,
    dbName: process.env.DB_NAME || "BalerDB",
    mailFrom: process.env.MAIL_FROM || "s.edge@bollegraaf.com",
  });
});

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    await sendPasswordResetEmail({
      email: req.body.email,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/:id/send-invite", async (req, res, next) => {
  try {
    await sendPasswordResetEmail({
      email: req.body.email,
      name: req.body.name,
      isInvite: true,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/:id/send-password-reset", async (req, res, next) => {
  try {
    await sendPasswordResetEmail({
      email: req.body.email,
      name: req.body.name,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/reset-password", (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  const tokenData = resetTokens.get(token);

  if (!tokenData || tokenData.expiresAt < Date.now()) {
    return res.status(400).json({
      error: "Reset link is invalid or expired.",
    });
  }

  if (!password.trim()) {
    return res.status(400).json({
      error: "Password is required.",
    });
  }

  resetTokens.delete(token);

  return res.json({
    ok: true,
    email: tokenData.email,
  });
});

// Serve React frontend
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

app.use(express.static(frontendDist));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }

  return res.sendFile(path.join(frontendDist, "index.html"));
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);

    res.status(500).json({
      error: error instanceof Error ? error.message : "Server error",
    });
  },
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bollegraaf dashboard running on http://0.0.0.0:${PORT}`);
});