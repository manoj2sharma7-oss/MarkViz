const path = require("node:path");
const { spawn } = require("node:child_process");
const { Pool } = require("pg");

const port = 3200 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const testSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const firstEmail = `smoke-first-${testSuffix}@example.com`;
const secondEmail = `smoke-second-${testSuffix}@example.com`;
const firstUsername = `smoke-first-${testSuffix}`;
const secondUsername = `smoke-second-${testSuffix}`;
const databaseUrl = process.env.DATABASE_URL;
let server;

if (!databaseUrl) {
  console.error("MarkViz smoke test requires DATABASE_URL pointing to a PostgreSQL database.");
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not start in time.");
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

function cookieFrom(response) {
  const cookies = response.headers.getSetCookie?.() || [];
  const sessionCookie = cookies.find((cookie) => cookie.startsWith("markviz_session="));
  assert(sessionCookie, "Login did not return a session cookie.");
  return sessionCookie.split(";", 1)[0];
}

async function signup(email, username, phone) {
  const result = await request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Smoke Test User",
      schoolName: "Smoke Test School",
      schoolAddress: "Smoke Test Address",
      username,
      phone,
      email,
      password: "original123",
    }),
  });
  assert(result.response.status === 201, `Signup failed: ${JSON.stringify(result.body)}`);
}

async function login(email, password = "original123") {
  const result = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(result.response.ok, `Login failed: ${JSON.stringify(result.body)}`);
  return cookieFrom(result.response);
}

async function main() {
  server = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), DATABASE_URL: databaseUrl },
    stdio: "ignore",
  });
  await waitForServer();

  await signup(firstEmail, firstUsername, "9800544001");
  await signup(secondEmail, secondUsername, "9800544002");

  const duplicate = await request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Duplicate User",
      schoolName: "Smoke Test School",
      schoolAddress: "Smoke Test Address",
      username: firstUsername,
      phone: "9800544003",
      email: "duplicate@example.com",
      password: "original123",
    }),
  });
  assert(duplicate.response.status === 409, "Duplicate username was accepted.");

  const wrongLogin = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: firstEmail, password: "wrong-password" }),
  });
  assert(wrongLogin.response.status === 401, "Invalid password was accepted.");

  const wrongRecovery = await request("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: firstUsername, phone: "9800544999" }),
  });
  assert(wrongRecovery.response.status === 401, "Invalid recovery details were accepted.");

  const firstCookie = await login(firstEmail);
  const secondCookie = await login(secondEmail);
  const workspace = { students: [{ roll: 1, name: "Stored Student" }], level: "primary", marks: {} };
  const saved = await request("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: firstCookie },
    body: JSON.stringify(workspace),
  });
  assert(saved.response.ok, "Workspace save failed.");

  const firstData = await request("/api/workspace", { headers: { Cookie: firstCookie } });
  assert(firstData.body.data.students[0].name === "Stored Student", "Workspace data was not saved.");
  const secondData = await request("/api/workspace", { headers: { Cookie: secondCookie } });
  assert(secondData.body.data === null, "Workspace data leaked between users.");

  const recovery = await request("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: firstUsername, phone: "9800544001" }),
  });
  assert(recovery.response.ok && recovery.body.resetToken, "Password recovery verification failed.");
  const reset = await request("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resetToken: recovery.body.resetToken, newPassword: "new-password-123" }),
  });
  assert(reset.response.ok, `Password reset failed: ${JSON.stringify(reset.body)}`);
  const reusedReset = await request("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resetToken: recovery.body.resetToken, newPassword: "another-password" }),
  });
  assert(reusedReset.response.status === 401, "A reset token was accepted twice.");
  await login(firstEmail, "new-password-123");

  const logout = await request("/api/auth/logout", { method: "POST", headers: { Cookie: secondCookie } });
  assert(logout.response.ok, "Logout failed.");
  const protectedWorkspace = await request("/api/workspace", { headers: { Cookie: secondCookie } });
  assert(protectedWorkspace.response.status === 401, "Logged-out workspace remained accessible.");

  console.log("MarkViz smoke test passed: health, signup, login, two-step password reset, workspace persistence, and user isolation.");
}

main()
  .catch((error) => {
    console.error(`MarkViz smoke test failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) {
      await new Promise((resolve) => {
        if (server.exitCode !== null) return resolve();
        server.once("close", resolve);
        server.kill();
      });
    }
    const cleanup = new Pool({ connectionString: databaseUrl });
    await cleanup.query("DELETE FROM users WHERE email IN ($1, $2)", [firstEmail, secondEmail]);
    await cleanup.end();
  });
