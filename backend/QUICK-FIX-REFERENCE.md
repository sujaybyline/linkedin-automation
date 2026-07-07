# Quick Fix Reference - Batch Text Posts Errors

## Problem Summary
Getting errors when generating batch text posts: "Unknown column 'topic'" or "Ollama 502 error"

## ✅ All Fixed! Here's What Was Done:

### 1. Database Migration ✅
**Added missing columns to posts table:**
- `topic` VARCHAR(255) - stores post title/topic
- `post_type` ENUM - identifies text_only/image/carousel

**Status:** ✅ Migration completed successfully

### 2. Local Environment ✅
**Configured for Ollama:**
```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
AI_PROVIDER=auto
```

**Status:** ✅ Ollama is running with qwen3:8b model

### 3. Error Handling ✅
**Improved error messages:**
- Better diagnostics for connection issues
- Clear guidance for localhost vs hosted problems

**Status:** ✅ Enhanced error messages in place

---

## 🚀 Ready to Use

Your local environment is now ready to generate batch text posts!

**To test:**
1. Go to: http://localhost:5173/posts
2. Select "Byline Learning" company
3. Select "Ollama" provider
4. Click "Generate 5 text posts"
5. Should work without errors ✅

---

## 🌐 For Production Deployment

When deploying to **marketing.legatolxp.online**, update `.env`:

```env
# IMPORTANT: Change these before deploying
OLLAMA_BASE_URL=          # Empty - disable Ollama
AI_PROVIDER=auto          # Keep auto for fallback
```

Then run migration on production:
```bash
node scripts/migrate-add-topic-columns.js
```

---

## 🔧 Quick Commands

### Restart Server
```bash
# Use restart script (easiest)
restart-server.bat

# Or manually
node server.js
```

### Verify Database
```bash
node scripts/verify-posts-columns.js
```

### Test Batch Generation
```bash
node scripts/test-batch-text-posts.js
```

### Check Ollama
```bash
curl http://127.0.0.1:11434/api/tags
```

### Restart Backend (if needed)
```bash
# Stop existing server (Ctrl+C)
# Then:
node server.js
```

---

## 📚 Documentation Files

- **FIX-OLLAMA-502-HOSTED.md** - Complete Ollama 502 troubleshooting
- **FIXES-APPLIED.md** - Detailed fix documentation  
- **FIX-502-BATCH-TEXT-POSTS.md** - Original database fix guide

---

## ⚡ Troubleshooting

### Still getting errors?

**"Unknown column 'topic'"**
```bash
# Run migration again (safe)
node scripts/migrate-add-topic-columns.js
```

**"Ollama fetch failed"**
```bash
# Check if Ollama is running
curl http://127.0.0.1:11434/api/tags

# If not running, start it:
ollama serve
```

**Backend not picking up .env changes**
```bash
# Restart the backend server
# (Stop with Ctrl+C, then restart)
```

---

## ✅ Current Status

- [x] Database schema updated
- [x] Local Ollama configured
- [x] Error handling enhanced
- [x] Migration scripts ready
- [x] Verification scripts created
- [x] Documentation complete
- [x] Server syntax error fixed

**Result:** Batch text posts ready! Just restart the server. 🎉

For production, remember to disable Ollama in `.env` before deploying.
