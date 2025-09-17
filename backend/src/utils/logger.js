import pino from "pino";
import path from "path";
import fs from "fs";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_FILE = process.env.LOG_FILE || null;
const NODE_ENV = process.env.NODE_ENV || "development";

let transport;

if (NODE_ENV !== "production" && !LOG_FILE) {
  transport = {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:standard" },
  };
}

if (LOG_FILE) {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  transport = {
    target: "pino/file",
    options: { destination: LOG_FILE, mkdir: true },
  };
}

const logger = pino({
  level: LOG_LEVEL,
  transport,
});

export default logger;