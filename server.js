const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT) || 3000;
const databaseUrl = process.env.DATABASE_URL;
const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;
const isProduction = process.env.NODE_ENV === "production";

app.get("/", (request, response) => response.sendFile(path.join(__dirname, "markviz_landing_page.html")));

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Set it to your PostgreSQL connection string.");
  if (require.main === module) process.exitCode = 1;
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const databaseReady = initializeDatabase();

async function initializeDatabase() {
  if (!databaseUrl) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      school_name TEXT NOT NULL,
      school_address TEXT NOT NULL,
      email TEXT NOT NULL,
      username TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email));
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (LOWER(username)) WHERE username IS NOT NULL;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE TABLE IF NOT EXISTS workspace_data (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    DELETE FROM sessions WHERE expires_at <= $1;
    DELETE FROM password_resets WHERE expires_at <= $1;
  `, [Date.now()]);
}

app.use(express.json({ limit: "2mb" }));
app.use(async (request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  try {
    await databaseReady;
    if (!databaseUrl) return response.status(503).json({ error: "DATABASE_URL is not configured." });
    next();
  } catch (error) {
    console.error("Database initialization failed:", error);
    return response.status(503).json({ error: "Database is unavailable." });
  }
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || "").split(":");
  if (!salt || !key) return false;
  const derivedKey = crypto.scryptSync(password, salt, 64);
  const storedKey = Buffer.from(key, "hex");
  return storedKey.length === derivedKey.length && crypto.timingSafeEqual(derivedKey, storedKey);
}

function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  return { sessionId, expiresAt: Date.now() + sessionDurationMs, userId };
}

function setSessionCookie(response, sessionId, expiresAt) {
  const secure = isProduction ? "; Secure" : "";
  response.setHeader("Set-Cookie", `markviz_session=${sessionId}; Max-Age=${Math.floor((expiresAt - Date.now()) / 1000)}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

function clearSessionCookie(response) {
  const secure = isProduction ? "; Secure" : "";
  response.setHeader("Set-Cookie", `markviz_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

function getCookie(request, name) {
  const cookies = Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
  return cookies[name];
}

async function getSession(request) {
  const sessionId = getCookie(request, "markviz_session");
  if (!sessionId) return null;
  const result = await pool.query(`
    SELECT sessions.id, sessions.expires_at, users.id AS user_id, users.full_name, users.school_name, users.school_address, users.email
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = $1 AND sessions.expires_at > $2
  `, [sessionId, Date.now()]);
  return result.rows[0] || null;
}

async function requireSession(request, response, next) {
  try {
    const session = await getSession(request);
    if (!session) {
      if (request.path === "/markviz.html") return response.redirect("/Login.html");
      return response.status(401).json({ error: "You must be signed in." });
    }
    request.session = session;
    next();
  } catch (error) {
    console.error("Session lookup failed:", error);
    response.status(503).json({ error: "Authentication service unavailable." });
  }
}

app.post("/api/auth/signup", async (request, response) => {
  const { fullName, schoolName, schoolAddress, username, phone, email, password } = request.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedUsername = String(username || "").trim();
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  if (!fullName?.trim() || !schoolName?.trim() || !schoolAddress?.trim() || !normalizedUsername || normalizedPhone.length < 7 || !normalizedEmail || !password || password.length < 6) {
    return response.status(400).json({ error: "Please complete all fields, enter a valid phone number, and use a password of at least 6 characters." });
  }
  try {
    await pool.query(`
      INSERT INTO users (full_name, school_name, school_address, email, username, phone, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [fullName.trim(), schoolName.trim(), schoolAddress.trim(), normalizedEmail, normalizedUsername, normalizedPhone, hashPassword(password)]);
    return response.status(201).json({ ok: true });
  } catch (error) {
    if (error.code === "23505") return response.status(409).json({ error: "That email or username is already in use." });
    console.error(error);
    return response.status(500).json({ error: "Unable to create the account right now." });
  }
});

app.post("/api/auth/forgot-password", async (request, response) => {
  const username = String(request.body?.username || "").trim();
  const phone = String(request.body?.phone || "").replace(/\D/g, "");
  const result = await pool.query("SELECT id, username, phone FROM users WHERE LOWER(username) = LOWER($1)", [username]);
  const user = result.rows[0];
  if (!user || !user.phone || user.phone !== phone || phone.length < 3) return response.status(401).json({ error: "We could not verify that username and phone number." });
  await pool.query("DELETE FROM password_resets WHERE expires_at <= $1 OR user_id = $2", [Date.now(), user.id]);
  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  await pool.query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, user.id, Date.now() + 10 * 60 * 1000]);
  return response.json({ ok: true, resetToken });
});

app.post("/api/auth/reset-password", async (request, response) => {
  const resetToken = String(request.body?.resetToken || "");
  const newPassword = String(request.body?.newPassword || "");
  if (newPassword.length < 6) return response.status(400).json({ error: "Use a new password of at least 6 characters." });
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reset = await client.query("SELECT user_id FROM password_resets WHERE token_hash = $1 AND expires_at > $2 FOR UPDATE", [tokenHash, Date.now()]);
    if (!reset.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(401).json({ error: "This recovery request is invalid or has expired." });
    }
    const userId = reset.rows[0].user_id;
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashPassword(newPassword), userId]);
    await client.query("DELETE FROM password_resets WHERE token_hash = $1", [tokenHash]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
    return response.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.post("/api/auth/login", async (request, response) => {
  const normalizedEmail = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  const result = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [normalizedEmail]);
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return response.status(401).json({ error: "Invalid email or password." });
  const session = createSession(user.id);
  await pool.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [session.sessionId, session.userId, session.expiresAt]);
  setSessionCookie(response, session.sessionId, session.expiresAt);
  return response.json({ ok: true });
});

app.get("/api/auth/session", async (request, response) => {
  const session = await getSession(request);
  if (!session) return response.status(401).json({ authenticated: false });
  return response.json({ authenticated: true, user: { fullName: session.full_name, schoolName: session.school_name, email: session.email } });
});

app.post("/api/auth/logout", async (request, response) => {
  const sessionId = getCookie(request, "markviz_session");
  if (sessionId) await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
  clearSessionCookie(response);
  response.json({ ok: true });
});

app.get("/api/workspace", requireSession, async (request, response) => {
  const result = await pool.query("SELECT data_json, updated_at FROM workspace_data WHERE user_id = $1", [request.session.user_id]);
  if (!result.rows[0]) return response.json({ data: null, updatedAt: null });
  return response.json({ data: result.rows[0].data_json, updatedAt: result.rows[0].updated_at });
});

app.put("/api/workspace", requireSession, async (request, response) => {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) return response.status(400).json({ error: "Workspace data must be a JSON object." });
  const dataJson = JSON.stringify(request.body);
  if (Buffer.byteLength(dataJson, "utf8") > 2 * 1024 * 1024) return response.status(413).json({ error: "Workspace data is too large." });
  await pool.query(`
    INSERT INTO workspace_data (user_id, data_json, updated_at)
    VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET data_json = EXCLUDED.data_json, updated_at = CURRENT_TIMESTAMP
  `, [request.session.user_id, dataJson]);
  return response.json({ ok: true });
});

app.delete("/api/workspace", requireSession, async (request, response) => {
  await pool.query("DELETE FROM workspace_data WHERE user_id = $1", [request.session.user_id]);
  return response.json({ ok: true });
});

app.get("/health", async (request, response) => {
  await pool.query("SELECT 1");
  response.json({ ok: true, database: "postgresql" });
});

app.get("/markviz.html", requireSession, (request, response) => response.sendFile(path.join(__dirname, "markviz.html")));
app.use(express.static(__dirname, { index: "markviz_landing_page.html" }));

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
