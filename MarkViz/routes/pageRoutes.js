const express = require("express");
const pageController = require("../controllers/pageController");
const { requirePageSession } = require("../middleware/auth");

const router = express.Router();

router.get("/", pageController.renderLanding);
router.get("/login", pageController.renderLogin);
router.get("/dashboard", requirePageSession, pageController.renderDashboard);
router.get("/health", pageController.health);

// Legacy static filenames from the old flat layout — keep old links/bookmarks working.
router.get("/Login.html", (request, response) => response.redirect(301, "/login"));
router.get("/markviz.html", (request, response) => response.redirect(301, "/dashboard"));
router.get("/markviz_landing_page.html", (request, response) => response.redirect(301, "/"));

module.exports = router;
