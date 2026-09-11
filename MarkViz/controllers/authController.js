const crypto = require("node:crypto");
const { pool } = require("../config/database");
const { hashPassword, verifyPassword } = require("../utils/password");
const { createSession, setSessionCookie, clearSessionCookie, getCookie, SESSION_COOKIE_NAME } = require("../utils/cookies");
const { getSession } = require("../middleware/auth");

async function signup(request, response) {
  const { fullName, schoolName, schoolAddress, username, phone, email, password } = request.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedUsername = String(username || "").trim();
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  if (
    !fullName?.trim() ||
    !schoolName?.trim() ||
    !schoolAddress?.trim() ||
    !normalizedUsername ||
    normalizedPhone.length < 7 ||
    !normalizedEmail ||
    !password ||
    password.length < 6
  ) {
    return response.status(400).json({
      error: "Please complete all fields, enter a valid phone number, and use a password of at least 6 characters.",
    });
  }
  try {
    await pool.query(
      `
      INSERT INTO users (full_name, school_name, school_address, email, username, phone, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [fullName.trim(), schoolName.trim(), schoolAddress.trim(), normalizedEmail, normalizedUsername, normalizedPhone, hashPassword(password)],
    );
    return response.status(201).json({ ok: true });
  } catch (error) {
    if (error.code === "23505") return response.status(409).json({ error: "That email or username is already in use." });
    console.error(error);
    return response.status(500).json({ error: "Unable to create the account right now." });
  }
}

async function forgotPassword(request, response) {
  const username = String(request.body?.username || "").trim();
  const phone = String(request.body?.phone || "").replace(/\D/g, "");
  const result = await pool.query("SELECT id, username, phone FROM users WHERE LOWER(username) = LOWER($1)", [username]);
  const user = result.rows[0];
  if (!user || !user.phone || user.phone !== phone || phone.length < 3) {
    return response.status(401).json({ error: "We could not verify that username and phone number." });
  }
  await pool.query("DELETE FROM password_resets WHERE expires_at <= $1 OR user_id = $2", [Date.now(), user.id]);
  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  await pool.query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    tokenHash,
    user.id,
    Date.now() + 10 * 60 * 1000,
  ]);
  return response.json({ ok: true, resetToken });
}

async function resetPassword(request, response) {
  const resetToken = String(request.body?.resetToken || "");
  const newPassword = String(request.body?.newPassword || "");
  if (newPassword.length < 6) return response.status(400).json({ error: "Use a new password of at least 6 characters." });
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reset = await client.query("SELECT user_id FROM password_resets WHERE token_hash = $1 AND expires_at > $2 FOR UPDATE", [
      tokenHash,
      Date.now(),
    ]);
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
}

async function login(request, response) {
  const normalizedEmail = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  const result = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [normalizedEmail]);
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return response.status(401).json({ error: "Invalid email or password." });
  const session = createSession(user.id);
  await pool.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [session.sessionId, session.userId, session.expiresAt]);
  setSessionCookie(response, session.sessionId, session.expiresAt);
  return response.json({ ok: true });
}

async function getCurrentSession(request, response) {
  const session = await getSession(request);
  if (!session) return response.status(401).json({ authenticated: false });
  return response.json({
    authenticated: true,
    user: { fullName: session.full_name, schoolName: session.school_name, email: session.email },
  });
}

async function logout(request, response) {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);
  if (sessionId) await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
  clearSessionCookie(response);
  response.json({ ok: true });
}

module.exports = { signup, forgotPassword, resetPassword, login, getCurrentSession, logout };
