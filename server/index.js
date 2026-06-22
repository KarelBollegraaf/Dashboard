import crypto from "node:crypto";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const dashboardPublicUrl = process.env.DASHBOARD_PUBLIC_URL || "http://localhost:5173";
const resetTokens = new Map();
const tokenLifetimeMs = 60 * 60 * 1000;

app.use(cors());
app.use(express.json());

function requireEnv(name) {
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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createResetToken(email) {
  const token = crypto.randomBytes(32).toString("hex");
  resetTokens.set(token, {
    email,
    expiresAt: Date.now() + tokenLifetimeMs,
  });
  return token;
}

function createResetLink(token) {
  const url = new URL("/reset-password", dashboardPublicUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.MAIL_FROM || "Bollegraaf Dashboard <s.edge@bollegraaf.com>",
    to,
    subject,
    text,
    html,
  });
}

async function sendPasswordResetEmail({ email, name, isInvite = false }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const error = new Error("Email is required.");
    error.status = 400;
    throw error;
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
    text: `${greeting}\n\n${intro}\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nBollegraaf Dashboard`,
    html: `
      <p>${greeting}</p>
      <p>${intro}</p>
      <p><a href="${resetLink}">Open password setup</a></p>
      <p>This link expires in 1 hour.</p>
      <p>Bollegraaf Dashboard</p>
    `,
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mailFrom: process.env.MAIL_FROM || "s.edge@bollegraaf.com" });
});

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    await sendPasswordResetEmail({ email: req.body.email });
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

app.post("/api/auth/reset-password", (req, res, next) => {
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    const tokenData = resetTokens.get(token);

    if (!tokenData || tokenData.expiresAt < Date.now()) {
      const error = new Error("Reset link is invalid or expired.");
      error.status = 400;
      throw error;
    }

    if (!password.trim()) {
      const error = new Error("Password is required.");
      error.status = 400;
      throw error;
    }

    resetTokens.delete(token);

    // In this client-local demo, the frontend updates its local user storage.
    // In production, update the hashed password in the backend database here instead.
    res.json({ ok: true, email: tokenData.email });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || "Server error",
  });
});

app.listen(port, () => {
  console.log(`Dashboard mail backend running on http://localhost:${port}`);
});
