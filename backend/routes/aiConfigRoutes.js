const express = require("express");
const asyncHandler = require("express-async-handler");
const { apiSuccess } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { getAiConfigForAdmin, updateAiConfig } = require("../lib/aiConfig");
const { writeAuditLog } = require("../lib/audit");

const router = express.Router();

router.get(
  "/",
  authRequired,
  requirePerm("settings:live"),
  asyncHandler(async (_req, res) => {
    return apiSuccess(res, await getAiConfigForAdmin());
  })
);

router.put(
  "/",
  authRequired,
  requirePerm("settings:live"),
  asyncHandler(async (req, res) => {
    const before = await getAiConfigForAdmin();
    const updated = await updateAiConfig(req.body || {}, req.user.id);

    await writeAuditLog({
      actorId: req.user.id,
      action: "ai_config.updated",
      entityType: "app_settings",
      entityId: "ai",
      metadata: {
        ai_enabled: updated.ai_enabled,
        ai_provider: updated.ai_provider,
        gemini_model: updated.gemini_model,
        openai_model: updated.openai_model,
        gemini_key_changed: Boolean(
          req.body?.gemini_api_key &&
            !String(req.body.gemini_api_key).includes("••••")
        ),
        openai_key_changed: Boolean(
          req.body?.openai_api_key &&
            !String(req.body.openai_api_key).includes("••••")
        ),
        had_gemini_before: before.gemini_api_key_set,
        had_openai_before: before.openai_api_key_set,
      },
    });

    return apiSuccess(res, updated);
  })
);

module.exports = router;
