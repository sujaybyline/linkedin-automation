const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const env = require("./env");
const { testConnection } = require("./db");
const { HttpError } = require("./errors");
const authRoutes = require("./routes/authRoutes");
const cardsRoutes = require("./routes/cardsRoutes");
const captionsRoutes = require("./routes/captionsRoutes");
const approvalsRoutes = require("./routes/approvalsRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const queueRoutes = require("./routes/queueRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const logsRoutes = require("./routes/logsRoutes");
const systemRoutes = require("./routes/systemRoutes");
const linkedinRoutes = require("./routes/linkedinRoutes");
const aiRoutes = require("./routes/aiRoutes");
const aiConfigRoutes = require("./routes/aiConfigRoutes");
const companyProfilesRoutes = require("./routes/companyProfilesRoutes");
const healthRoutes = require("./routes/healthRoutes");

const app = express();

app.set("trust proxy", true);

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "apex-linkedin-api" });
});

function mountApiRoutes(router) {
  router.use("/health", healthRoutes);
  router.use("/cron", healthRoutes);
  router.use("/auth", authRoutes);
  router.use("/cards", cardsRoutes);
  router.use("/captions", captionsRoutes);
  router.use("/approvals", approvalsRoutes);
  router.use("/schedule", scheduleRoutes);
  router.use("/queue", queueRoutes);
  router.use("/dashboard", dashboardRoutes);
  router.use("/logs", logsRoutes);
  router.use("/system", systemRoutes);
  router.use("/linkedin", linkedinRoutes);
  router.use("/ai", aiRoutes);
  router.use("/settings/ai", aiConfigRoutes);
  router.use("/company-profiles", companyProfilesRoutes);
}

// Local dev: Vite proxy strips /api → /health, /auth, …
mountApiRoutes(app);

// Production: LiteSpeed/cPanel often forwards /api/* without stripping the prefix
const apiRouter = express.Router ();
apiRouter.get("/", (_req, res) => {
  res.json({ ok: true, service: "apex-linkedin-api" });
});
mountApiRoutes(apiRouter);
app.use("/api", apiRouter);

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ data: null, error: { message: err.message } });
  }
  console.error("[api]", err.stack || err.message || err);
  const errorMessage = env.NODE_ENV === "production" ? "Internal server error" : err.message || "Internal server error";
  return res.status(500).json({ data: null, error: { message: errorMessage } });
});

async function start() {
  const connected = await testConnection();
  if (connected) {
    console.log("[db] Connected to MySQL:", env.getDbConfig().database);
  } else {
    console.warn("[db] MySQL not connected — check backend/.env");
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[api] APEX LinkedIn API on http://localhost:${env.PORT}`);
    console.log(`[api] Upload dir: ${env.UPLOAD_DIR}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[api] Port ${env.PORT} is already in use. Change PORT in backend/.env (e.g. 4002) or stop the other app.`
      );
      process.exit(1);
    }
    throw err;
  });
}

start();

module.exports = app;
