const express = require("express");
const asyncHandler = require("express-async-handler");
const { apiSuccess, apiError } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const {
  listCompanyProfiles,
  getCompanyProfileById,
  deleteCompanyProfile,
} = require("../lib/companyProfilesRepository");
const { writeAuditLog } = require("../lib/audit");

const router = express.Router();

router.get(
  "/",
  authRequired,
  requirePerm("dashboard:view"),
  asyncHandler(async (_req, res) => {
    const profiles = await listCompanyProfiles();
    return apiSuccess(res, profiles);
  })
);

router.get(
  "/:id",
  authRequired,
  requirePerm("dashboard:view"),
  asyncHandler(async (req, res) => {
    const profile = await getCompanyProfileById(req.params.id);
    if (!profile) return apiError(res, "Company profile not found", 404);
    return apiSuccess(res, profile);
  })
);

router.delete(
  "/:id",
  authRequired,
  requirePerm("cards:edit"),
  asyncHandler(async (req, res) => {
    const profile = await deleteCompanyProfile(req.params.id);
    if (!profile) return apiError(res, "Company profile not found", 404);

    await writeAuditLog({
      actorId: req.user.id,
      action: "company_profile.deleted",
      entityType: "company_profile",
      entityId: String(profile.id),
      metadata: { companyName: profile.companyName },
    });

    return apiSuccess(res, { deleted: profile.id, companyName: profile.companyName });
  })
);

module.exports = router;
