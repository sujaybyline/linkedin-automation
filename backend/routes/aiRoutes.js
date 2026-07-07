const express = require("express");
const multer = require("multer");
const asyncHandler = require("express-async-handler");
const { apiSuccess, apiError } = require("../lib/apiResponse");
const { authRequired, requirePerm } = require("../middleware/auth");
const { generateCaptionPreview, listAvailableProviders } = require("../lib/aiCaptionService");
const { generateImageFromPrompt } = require("../lib/geminiImageService");
const { fetchCompanyIntel } = require("../lib/companyIntelService");
const { saveCompanyProfile } = require("../lib/companyProfilesRepository");
const { generateBatchPosts } = require("../lib/batchTextPostsService");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const intelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
const router = express.Router();

router.get(
  "/providers",
  authRequired,
  requirePerm("captions:generate"),
  asyncHandler(async (_req, res) => {
    return apiSuccess(res, listAvailableProviders());
  })
);

router.post(
  "/caption",
  authRequired,
  requirePerm("captions:generate"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { topic, prompt, provider, company_profile_id } = req.body;
    const file = req.file;

    if (!topic && !prompt && !file) {
      return apiError(res, "Provide a topic, prompt, or image");
    }

    let image = null;
    if (file) {
      image = {
        mimeType: file.mimetype,
        base64: file.buffer.toString("base64"),
      };
    }

    try {
      const result = await generateCaptionPreview({
        topic: topic || "",
        prompt: prompt || "",
        filename: file?.originalname || "",
        image,
        provider: provider || "",
        companyProfileId: company_profile_id || "",
        fallbackToRules: true,
      });
      return apiSuccess(res, result);
    } catch (err) {
      return apiError(res, err.message || "Caption generation failed", 502);
    }
  })
);

router.post(
  "/image",
  authRequired,
  requirePerm("captions:generate"),
  asyncHandler(async (req, res) => {
    const { prompt, topic } = req.body;
    if (!prompt?.trim()) return apiError(res, "prompt is required");

    try {
      const result = await generateImageFromPrompt(prompt.trim(), topic?.trim() || "");
      return apiSuccess(res, {
        mimeType: result.mimeType,
        base64: result.base64,
        model: result.model,
      });
    } catch (err) {
      return apiError(
        res,
        err.message || "Image generation unavailable. Try uploading your own image.",
        502
      );
    }
  })
);

router.post(
  "/fetch-info",
  authRequired,
  requirePerm("captions:generate"),
  intelUpload.single("file"),
  asyncHandler(async (req, res) => {
    const { company_name, website_url, provider } = req.body;
    const file = req.file;

    if (!website_url?.trim() && !file) {
      return apiError(res, "Provide a website URL or upload a company document (at least one is required)");
    }

    try {
      // Pipeline: scrape → clean text → single AI analysis → store profile
      const result = await fetchCompanyIntel({
        companyName: company_name || "",
        websiteUrl: website_url || "",
        file,
        provider: provider || "",
      });

      const websiteUrl = website_url?.trim() || "";
      const saved = await saveCompanyProfile({
        companyName: result.companyName || company_name || "",
        websiteUrl: websiteUrl.startsWith("http") ? websiteUrl : websiteUrl ? `https://${websiteUrl}` : "",
        intel: result,
        sourcesAnalyzed: result.sourcesAnalyzed || [],
        source: result.source,
        model: result.model,
        createdBy: req.user.id,
      });

      if (result.pipeline) {
        result.pipeline.step4_store = { status: "done", profileId: saved.id, slug: saved.slug };
      }

      return apiSuccess(res, { ...result, profileId: saved.id, slug: saved.slug });
    } catch (err) {
      return apiError(res, err.message || "Company research failed", 502);
    }
  })
);

router.post(
  "/batch-text-posts",
  authRequired,
  requirePerm("cards:upload"),
  asyncHandler(async (req, res) => {
    const { company_profile_id, count, provider } = req.body;
    if (!company_profile_id) return apiError(res, "company_profile_id is required");

    try {
      const result = await generateBatchPosts({
        companyProfileId: Number(company_profile_id),
        count,
        provider: provider || "",
        createdBy: req.user.id,
      });
      return apiSuccess(res, result);
    } catch (err) {
      return apiError(res, err.message || "Batch post generation failed", 502);
    }
  })
);

module.exports = router;
