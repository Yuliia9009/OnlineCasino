// src/index.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import logger from "./utils/logger.js";
import prisma from "./db.js";

import authRoutes from "./routes/auth.js";
import spinsRoutes from "./routes/spins.js";
import playersRoutes from "./routes/players.js";
import statsRoutes from "./routes/stats.js";
import depositsRoutes from "./routes/deposits.js";
import withdrawalsRoutes from "./routes/withdrawals.js";

import feedRoutes from "./routes/feed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.join(__dirname, "../package.json"), "utf8")
);

const app = express();
const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || "development";

const TRUST_PROXY = String(process.env.TRUST_PROXY || "").toLowerCase() === "true";
if (TRUST_PROXY) {
  app.set("trust proxy", 1);
}

/* ---------- security ---------- */
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: false,
}));
app.use(cookieParser());

/* ---------- CORS ---------- */
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(cors({
  origin: ORIGIN,
  credentials: true,
}));

// Global preflight (some clients send OPTIONS explicitly)
app.options(/.*/, cors({ origin: ORIGIN, credentials: true }));

/* ---------- body parser ---------- */
app.use(express.json({ limit: "1mb" }));

// JSON parse error guard (returns 400 instead of crashing)
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ ok: false, error: "bad_json", message: err.message });
  }
  next(err);
});

/* ---------- HTTP -> pino ---------- */
const morganStream = { write: (msg) => logger.info(msg.trim()) };
app.use(morgan("tiny", { stream: morganStream }));

/* ---------- rate limit (в prod) ---------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === "production" ? 1000 : 0,
  standardHeaders: true,
  legacyHeaders: false,
});
if (NODE_ENV === "production") app.use(limiter);

/* ---------- подробный лог в консоль (dev) ---------- */
if (NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    logger.debug(
      { method: req.method, url: req.originalUrl, query: req.query, body: req.body },
      "➡️  incoming request"
    );
    next();
  });
}

/* ---------- dev-логгер запросов в БД (http_logs) ---------- */
/* ВАЖНО: этот мидлвар ставим после express.json, чтобы body уже был распарсен */
if (NODE_ENV !== "production") {
  app.use(async (req, _res, next) => {
    try {
      await prisma.http_logs.create({
        data: {
          level: "info",
          message: "HTTP request",
          path: req.originalUrl || req.url,
          method: req.method,
          address: req.ip || null,
          // ограничим размер, чтобы не переполнить колонку
          meta: JSON.stringify({ query: req.query, body: req.body }).slice(0, 60000),
        },
      });
    } catch {
      // молча игнорим ошибки логгера, чтобы не ломать основной запрос
    }
    next();
  });
}

/* ---------- маршруты ---------- */
app.use("/auth", authRoutes);

// lightweight diagnostics
app.get("/version", (_req, res) => {
  res.json({ ok: true, name: pkg.name, version: pkg.version, env: NODE_ENV });
});
app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    logger.error(e, "readiness_check_failed");
    res.status(500).json({ ok: false, error: "db_unavailable" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/spins", spinsRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/deposits", depositsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);
app.use("/api/feed", feedRoutes);

/* Алиасы под фронт */
app.get("/api/history", (req, res) => {
  const address = req.query.address || "";
  res.redirect(307, `/api/spins?address=${encodeURIComponent(address)}`);
});

/* ---------- 404 ---------- */
app.use((req, res) => {
  logger.warn({ path: req.originalUrl, method: req.method }, "route_not_found");
  res.status(404).json({ ok: false, error: "not_found" });
});

/* ---------- централизованный обработчик ошибок ---------- */
app.use((err, _req, res, _next) => {
  const status = Number(err.status) || 500;
  const code = err.code || "internal_error";
  logger.error(err, "Unhandled error");
  res.status(status).json({ ok: false, error: code, message: err.message });
});

/* ---------- старт и graceful shutdown ---------- */
const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: NODE_ENV, corsOrigin: ORIGIN }, "✅ Backend API running");
});

async function shutdown(sig) {
  try {
    logger.info({ sig }, "shutting_down");
    server.close(() => logger.info("http server closed"));
    await prisma.$disconnect().catch(() => {});
  } catch (e) {
    logger.error(e, "shutdown_error");
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  logger.error(err, "Uncaught Exception");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error(reason, "Unhandled Rejection");
});