const express = require("express");
const workspaceController = require("../controllers/workspaceController");
const { requireApiSession } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireApiSession, workspaceController.getWorkspace);
router.put("/", requireApiSession, workspaceController.saveWorkspace);
router.delete("/", requireApiSession, workspaceController.deleteWorkspace);

module.exports = router;
