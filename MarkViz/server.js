const path = require("node:path");
require("dotenv").config();
const express = require("express");

const { pool } = require("./config/database");
const ensureDatabase = require("./middleware/ensureDatabase");
const pageRoutes = require("./routes/pageRoutes");
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");

const app = express();
const port = Number(process.env.PORT) || 3000;

// View engine — every page is server-rendered from views/*.ejs.
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Static assets (stylesheets, client-side dashboard script, etc.).
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json({ limit: "2mb" }));

// Every request waits for the database pool/schema to be ready first.
app.use(ensureDatabase);

// Server-rendered pages: /, /login, /dashboard, /health.
app.use("/", pageRoutes);

// JSON APIs consumed by the client-side dashboard script.
app.use("/api/auth", authRoutes);
app.use("/api/workspace", workspaceRoutes);

// Anything else is an unknown route.
app.use((request, response) => {
  response.status(404).json({ error: "Not found." });
});

if (require.main === module) {
  const server = app.listen(port, "0.0.0.0", () => console.log(`MarkViz running on port ${port}`));
  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down MarkViz.`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = app;
