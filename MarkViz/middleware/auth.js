const { pool } = require("../config/database");
const { getCookie, SESSION_COOKIE_NAME } = require("../utils/cookies");

async function getSession(request) {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  const result = await pool.query(
    `
    SELECT sessions.id, sessions.expires_at, users.id AS user_id, users.full_name, users.school_name, users.school_address, users.email
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = $1 AND sessions.expires_at > $2
  `,
    [sessionId, Date.now()],
  );
  return result.rows[0] || null;
}

// Guards JSON API routes: responds 401 when there is no valid session.
async function requireApiSession(request, response, next) {
  try {
    const session = await getSession(request);
    if (!session) return response.status(401).json({ error: "You must be signed in." });
    request.session = session;
    next();
  } catch (error) {
    console.error("Session lookup failed:", error);
    response.status(503).json({ error: "Authentication service unavailable." });
  }
}

// Guards server-rendered pages: redirects to /login when there is no valid session.
async function requirePageSession(request, response, next) {
  try {
    const session = await getSession(request);
    if (!session) return response.redirect("/login");
    request.session = session;
    next();
  } catch (error) {
    console.error("Session lookup failed:", error);
    response.status(503).send("Authentication service unavailable.");
  }
}

module.exports = { getSession, requireApiSession, requirePageSession };
