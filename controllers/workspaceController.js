const { pool } = require("../config/database");

async function getWorkspace(request, response) {
  const result = await pool.query("SELECT data_json, updated_at FROM workspace_data WHERE user_id = $1", [request.session.user_id]);
  if (!result.rows[0]) return response.json({ data: null, updatedAt: null });
  return response.json({ data: result.rows[0].data_json, updatedAt: result.rows[0].updated_at });
}

async function saveWorkspace(request, response) {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    return response.status(400).json({ error: "Workspace data must be a JSON object." });
  }
  const dataJson = JSON.stringify(request.body);
  if (Buffer.byteLength(dataJson, "utf8") > 2 * 1024 * 1024) return response.status(413).json({ error: "Workspace data is too large." });
  await pool.query(
    `
    INSERT INTO workspace_data (user_id, data_json, updated_at)
    VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET data_json = EXCLUDED.data_json, updated_at = CURRENT_TIMESTAMP
  `,
    [request.session.user_id, dataJson],
  );
  return response.json({ ok: true });
}

async function deleteWorkspace(request, response) {
  await pool.query("DELETE FROM workspace_data WHERE user_id = $1", [request.session.user_id]);
  return response.json({ ok: true });
}

module.exports = { getWorkspace, saveWorkspace, deleteWorkspace };
