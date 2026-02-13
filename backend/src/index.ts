import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes.js";
import { loadAllowlist } from "./allowlist.js";
import { loadLightGroups } from "./lightGroups.js";
import { isHaConfigured, useDemoMode } from "./ha.js";

const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Resolve config path relative to this file (works from any cwd)
const __dirname = dirname(fileURLToPath(import.meta.url));
loadAllowlist(join(__dirname, "..", "..", "config", "allowlist.json"));
loadLightGroups(join(__dirname, "..", "..", "config", "lightGroups.json"));

const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
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

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
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
