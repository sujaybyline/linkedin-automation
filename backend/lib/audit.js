const { query } = require("../db");

async function writeAuditLog(params) {
  await query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.actorId ? Number(params.actorId) : null,
      params.action,
      params.entityType,
      params.entityId,
      JSON.stringify(params.metadata ?? {}),
    ]
  );
}

module.exports = { writeAuditLog };
