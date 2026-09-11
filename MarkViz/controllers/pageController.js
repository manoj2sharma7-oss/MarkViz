const { pool } = require("../config/database");
const { getSession } = require("../middleware/auth");

// GET / — public marketing/landing page.
function renderLanding(request, response) {
  response.render("landing");
}

// GET /login — public login/signup page. If already signed in, skip straight
// to the dashboard instead of showing the form again.
async function renderLogin(request, response) {
  const session = await getSession(request);
  if (session) return response.redirect("/dashboard");
  response.render("login");
}

// GET /dashboard — protected workspace shell. requirePageSession has already
// attached request.session by the time this runs.
function renderDashboard(request, response) {
  response.render("dashboard", {
    user: {
      fullName: request.session.full_name,
      schoolName: request.session.school_name,
      email: request.session.email,
    },
  });
}

// GET /health — used by uptime checks and the smoke test.
async function health(request, response) {
  await pool.query("SELECT 1");
  response.json({ ok: true, database: "postgresql" });
}

module.exports = { renderLanding, renderLogin, renderDashboard, health };
