const ROLE_LABELS = {
  admin: "Admin",
  team: "Team",
  content_manager: "Content Manager",
  reviewer: "Reviewer",
  publisher: "Publisher",
  viewer: "Viewer",
};

const ROLE_PERMISSIONS = {
  admin: [
    "dashboard:view",
    "cards:upload",
    "cards:edit",
    "captions:generate",
    "captions:edit",
    "claims:review",
    "approvals:manage",
    "schedule:manage",
    "logs:view",
    "audit:view",
    "linkedin:manage",
    "emergency:manage",
    "settings:live",
    "users:manage",
  ],
  team: [
    "dashboard:view",
    "cards:upload",
    "cards:edit",
    "captions:generate",
    "captions:edit",
    "schedule:manage",
    "linkedin:manage",
    "emergency:manage",
  ],
  content_manager: [
    "dashboard:view",
    "cards:upload",
    "cards:edit",
    "captions:generate",
    "captions:edit",
    "logs:view",
  ],
  reviewer: [
    "dashboard:view",
    "captions:edit",
    "claims:review",
    "approvals:manage",
    "logs:view",
  ],
  publisher: ["dashboard:view", "schedule:manage", "logs:view"],
  viewer: ["dashboard:view", "logs:view"],
};

function hasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

function requirePermission(role, permission) {
  if (!hasPermission(role, permission)) {
    const err = new Error("FORBIDDEN");
    err.status = 403;
    throw err;
  }
}

module.exports = { ROLE_LABELS, ROLE_PERMISSIONS, hasPermission, requirePermission };
