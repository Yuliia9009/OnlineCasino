import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import dotenv from "dotenv";
import logger from "./utils/logger.js";

import spinsRoutes from "./routes/spins.js";
import playersRoutes from "./routes/players.js";
import statsRoutes from "./routes/stats.js";
import depositsRoutes from "./routes/deposits.js";
import withdrawalsRoutes from "./routes/withdrawals.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || "development";

/* ---------- security ---------- */
app.use(helmet()); // базовые security-заголовки
app.use(cookieParser()); // парсинг куки

// rate limit (в dev отключить 0, в prod – включить - 1000 запросов с одного IP в 15 мин)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 мин
  max: NODE_ENV === "production" ? 1000 : 0, // 0 = без лимита в dev
  standardHeaders: true,
  legacyHeaders: false,
});
if (NODE_ENV === "production") app.use(limiter);

/* ---------- базовые middlewares ---------- */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // домен фронта
    credentials: false,
  })
);
app.use(express.json({ limit: "1mb" }));

// направляем HTTP-логи morgan в pino
const morganStream = { write: (msg) => logger.info(msg.trim()) };
app.use(morgan("tiny", { stream: morganStream }));

// детальный лог входящих запросов (только в dev)
if (NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    logger.debug(
      { method: req.method, url: req.originalUrl, query: req.query, body: req.body },
      "➡️  incoming request"
    );
    next();
  });
}

// маршруты аутентификации
app.use("/auth", authRoutes);

// лог исходящих ответов (статус + время)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    logger.info(
      { method: req.method, url: req.originalUrl, status: res.statusCode, durationMs: ms },
      "⬅️  response"
    );
  });
  next();
});

/* ---------- health ---------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------- API маршруты ---------- */
app.use("/api/spins", spinsRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/deposits", depositsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);

/* ---------- 404 для неизвестных маршрутов ---------- */
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

/* ---------- graceful shutdown ---------- */
const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: NODE_ENV }, "✅ Backend API running");
});

async function shutdown(sig) {
  try {
    logger.info({ sig }, "shutting_down");
    server.close(() => logger.info("http server closed"));
    // если используем prisma:
    // await prisma.$disconnect().catch(() => {});
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