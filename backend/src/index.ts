import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes.js";
import { loadAllowlist } from "./allowlist.js";
import { loadLightGroups } from "./lightGroups.js";
import { isHaConfigured, useDemoMode } from "./ha.js";
import { initMqtt } from "./mqtt.js";

const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOW_LOCAL_ORIGINS = process.env.ALLOW_LOCAL_ORIGINS === "true";

// Resolve config path relative to this file (works from any cwd)
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..", "..");
loadAllowlist(join(rootDir, "config", "allowlist.json"));

function getAppVersion(): string {
  try {
    const pkgPath = join(rootDir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
      return typeof pkg.version === "string" ? pkg.version : "?";
    }
  } catch {
    /* ignore */
  }
  return "?";
}
const APP_VERSION = getAppVersion();
loadLightGroups(join(rootDir, "config", "lightGroups.json"));
initMqtt(join(rootDir, "config", "mqttLights.json"));

/** Only allow origins from RFC 1918 private IP ranges (10.x, 172.16-31.x, 192.168.x) or localhost. */
function isPrivateNetworkOrigin(origin: string, port: number): boolean {
  if (!origin.startsWith("http://") || !origin.endsWith(`:${port}`)) return false;
  const host = origin.slice(7, origin.lastIndexOf(":"));
  return (
    host === "localhost" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow: no origin (same-origin), in allowlist, or same host/port (local network)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
        return;
      }
      // Allow private-network origins on our port when ALLOW_LOCAL_ORIGINS=true
      if (ALLOW_LOCAL_ORIGINS && isPrivateNetworkOrigin(origin, PORT)) {
        cb(null, true);
        return;
      }
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: { error: "Too many requests" },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: "100kb" }));

// Request logging — 'combined' in production for full details, 'dev' for concise coloured output.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
  skip: (_req, _res) => _req.url === "/health", // skip noisy health checks
}));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    ha_configured: isHaConfigured(),
    demo_mode: useDemoMode(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/coffee", router);

const staticDir = join(__dirname, "..", "..", "frontend", "build");
if (existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => res.sendFile(join(staticDir, "index.html")));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Coffee API listening on http://0.0.0.0:${PORT}`);
  console.log(`CORS allowed origins: ${ALLOWED_ORIGINS.join(", ") || "(none)"}`);
  if (useDemoMode()) {
    console.log("Running in DEMO MODE — using mock data (no Home Assistant connection).");
  } else if (!isHaConfigured()) {
    console.warn("WARN: HA_BASE_URL or HA_TOKEN not set; HA calls will fail.");
  }
});
