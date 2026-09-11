const { databaseReady, databaseUrl } = require("../config/database");

// Sets no-store caching (auth/data responses should never be cached) and
// makes sure the PostgreSQL pool has finished initializing/migrating
// before any route handler runs.
async function ensureDatabase(request, response, next) {
  response.setHeader("Cache-Control", "no-store");
  try {
    await databaseReady;
    if (!databaseUrl) return response.status(503).json({ error: "DATABASE_URL is not configured." });
    next();
  } catch (error) {
    console.error("Database initialization failed:", error);
    return response.status(503).json({ error: "Database is unavailable." });
  }
}

module.exports = ensureDatabase;
