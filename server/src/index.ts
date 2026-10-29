import cors from "cors";
import express from "express";
import { pathToFileURL } from "node:url";
import { env } from "./config/env.js";
import { runSchemaMigration } from "./db/index.js";
import { errorHandler } from "./middleware/security.js";
import { apiRouter } from "./routes/api.routes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
}

async function bootstrap() {
  const migration = await runSchemaMigration();
  console.log(
    `[Hyperlocal Server] Database ready (${migration.mode}): ${migration.seededRestaurants} restaurants & ${migration.seededMenuItems} menu items available.`
  );

  const app = createApp();
  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(
      `[Hyperlocal Server] Listening on http://localhost:${env.PORT} (AI Model: gemini-2.5-flash)`
    );
  });
}

const isMainEntry =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainEntry && process.env.NODE_ENV !== "test") {
  bootstrap().catch((err) => {
    console.error("[Hyperlocal Server] Startup error:", err);
    process.exit(1);
  });
}
