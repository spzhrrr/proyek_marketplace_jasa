import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { UPLOADS_ROOT, FRONTEND_ROOT } from "./config/paths.js";
import { logger, attachUser, notFound, errorHandler } from "./middleware/index.js";

import gatewayRoutes from "./routes/gateway.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import marketplaceRoutes from "./routes/marketplace.routes.js";

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ["http://localhost:5173", "http://127.0.0.1:5173"];
  if (origin && allowed.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  } else {
    res.header("Access-Control-Allow-Origin", "*");
  }
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key, X-Webhook-Secret");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/uploads", express.static(UPLOADS_ROOT));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(logger);
app.use(attachUser);

app.use("/gateway/api", gatewayRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/mp", marketplaceRoutes);
app.use("/api", paymentRoutes);

const reactDist = path.join(FRONTEND_ROOT, "dist");
const reactIndex = path.join(reactDist, "index.html");
const hasFrontendBuild = fs.existsSync(reactIndex);

if (hasFrontendBuild) {
  app.use(express.static(reactDist));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/gateway/api") ||
      req.path.startsWith("/uploads")
    ) {
      return next();
    }
    res.sendFile(reactIndex, (err) => {
      if (err) next(err);
    });
  });
} else {
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/gateway/api") ||
      req.path.startsWith("/uploads")
    ) {
      return next();
    }
    res.status(503).json({
      ok: false,
      error:
        "Frontend belum di-build. Dev: cd frontend && npm run dev (port 5173). Production: cd frontend && npm run build",
    });
  });
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} sudah dipakai. Matikan proses lama atau set PORT=3001`);
    process.exit(1);
  }
  throw err;
});
