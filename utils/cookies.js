const crypto = require("node:crypto");
const { isProduction } = require("../config/database");

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
const SESSION_COOKIE_NAME = "markviz_session";

function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  return { sessionId, expiresAt: Date.now() + SESSION_DURATION_MS, userId };
}

function setSessionCookie(response, sessionId, expiresAt) {
  const secure = isProduction ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${sessionId}; Max-Age=${Math.floor((expiresAt - Date.now()) / 1000)}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

function clearSessionCookie(response) {
  const secure = isProduction ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

function getCookie(request, name) {
  const cookies = Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
      }),
  );
  return cookies[name];
}

module.exports = {
  SESSION_DURATION_MS,
  SESSION_COOKIE_NAME,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getCookie,
};
