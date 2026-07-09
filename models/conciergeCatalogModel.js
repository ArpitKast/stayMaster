"use strict";

const pool = require("../config/dbConnection");

/**
 * Active concierge rows for a parent category (0 = top-level tabs).
 * Ordered by id for stable UI.
 */
async function listActiveByParent(parent = 0) {
  const p = Number(parent);
  const parentId = Number.isFinite(p) ? p : 0;
  const [rows] = await pool.query(
    `SELECT id, parent, name, description, display_image, status, created_at, updated_at
     FROM concierge_services
     WHERE parent = ? AND status = 1
     ORDER BY sort_order ASC, id ASC`,
    [parentId]
  );
  return rows;
}

/** Collapse duplicate names (same parent already implied); keeps first row by id order. */
function dedupeByName(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = String(r.name || "")
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

module.exports = {
  listActiveByParent,
  dedupeByName,
};
