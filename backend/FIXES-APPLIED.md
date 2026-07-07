# Fixes Applied - Batch Text Posts Issue

## Issues Encountered

### Issue 1: Ollama 502 Error on Hosted Environment
**Error:** `Error: Ollama fetch failed` with 502 Bad Gateway
**Cause:** `OLLAMA_BASE_URL=http://127.0.0.1:11434` works locally but fails on hosted servers

### Issue 2: Database Schema Missing Columns
**Error:** `Unknown column 'topic' in 'field list'`
**Cause:** Posts table missing `topic` and `post_type` columns needed for batch text generation

## Solutions Applied

### ✅ Fix 1: Database Migration
**Action:** Ran migration to add missing columns

```bash
node scripts/migrate-add-topic-columns.js
```

**Results:**
- ✓ Added `topic` column (VARCHAR 255)
- ✓ Added `post_type` column (ENUM: 'text_only', 'image', 'carousel')
- ✓ Backfilled 4 existing posts with topic data from visual_cards
- ✓ Backfilled 4 existing posts with post_type data

**Verification:**
```bash
node scripts/verify-posts-columns.js
```

### ✅ Fix 2: Enhanced Error Handling
**Action:** Updated `lib/aiTextClient.js` with better error messages

**Changes:**
- Added specific handling for 502 errors from Ollama
- Added connection refused error handling
- Provides actionable error messages:
  - Indicates if Ollama is not running
  - Explains localhost vs hosted environment issues
  - Suggests configuration fixes

### ✅ Fix 3: Environment Configuration
**Action:** Configured `.env` for local development with Ollama

**Current Configuration:**
```env
# Local development
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
AI_PROVIDER=auto

# Fallback providers
GEMINI_API_KEY=[configured]
OPENAI_API_KEY=[configured]
```

**For Production Deployment:**
When deploying to hosted server, change:
```env
# Disable Ollama on hosted
OLLAMA_BASE_URL=
AI_PROVIDER=auto  # Will use Gemini/OpenAI
```

### ✅ Fix 4: Documentation Created
**Files Created:**
1. `FIX-OLLAMA-502-HOSTED.md` - Complete guide for Ollama 502 issues
2. `verify-posts-columns.js` - Script to verify database schema
3. `FIXES-APPLIED.md` - This file

## Testing Results

### ✓ Database Verification
```
Posts table structure verified:
- topic column: EXISTS
- post_type column: EXISTS
Status: Ready for batch text posts
```

### ✓ Ollama Connectivity
```
curl http://127.0.0.1:11434/api/tags
Status: 200 OK
Available models: qwen3:8b
```

### ✓ Configuration Status
- AI Provider: auto (with fallback)
- Gemini: Configured
- OpenAI: Configured
- Ollama: Configured (local only)

## Next Steps

### For Local Development
1. **Restart backend server** to load updated `.env`:
   ```bash
   # Stop existing Node processes if needed
   # Then start server:
   node server.js
   ```

2. **Test batch text generation:**
   - Go to Create Post page
   - Select company: Byline Learning
   - Select AI provider: Ollama
   - Click "Generate 5 text posts"
   - Should work without errors

### For Production Deployment

**Before deploying to hosted server:**

1. **Update `.env` for production:**
   ```env
   # Disable Ollama
   OLLAMA_BASE_URL=
   
   # Use cloud providers
   AI_PROVIDER=auto
   ```

2. **Run database migration on production database:**
   ```bash
   # SSH into server
   cd /path/to/backend
   node scripts/migrate-add-topic-columns.js
   ```

3. **Deploy updated code:**
   - `lib/aiTextClient.js` (enhanced error handling)
   - `mysql/add_topic_and_post_type.sql` (migration)
   - `scripts/migrate-add-topic-columns.js` (migration script)

4. **Verify on production:**
   ```bash
   node scripts/verify-posts-columns.js
   ```

## Common Issues & Solutions

### Issue: "Cannot connect to Ollama"
**Solution:** 
- Verify Ollama is running: `curl http://127.0.0.1:11434/api/tags`
- If not running: `ollama serve`
- Check model exists: `ollama list`

### Issue: Still getting "Unknown column 'topic'"
**Solution:**
- Verify migration ran: `node scripts/verify-posts-columns.js`
- Check database connection in `.env`
- Run migration again (safe to run multiple times)

### Issue: 502 on production
**Solution:**
- Set `OLLAMA_BASE_URL=` (empty) in production `.env`
- Ensure `GEMINI_API_KEY` or `OPENAI_API_KEY` is set
- Restart server after `.env` changes

## Architecture Notes

### Provider Fallback Logic
The system automatically tries providers in this order:

1. **User selected provider** (e.g., "Ollama")
   - If fails → tries next

2. **Auto mode** (`AI_PROVIDER=auto`)
   - Tries all configured providers
   - Order: Gemini → OpenAI → Ollama
   
3. **Fallback behavior**
   - Continues to next provider on failure
   - Only fails if all providers fail

### Duplicate Topic Prevention
The batch text generator now:
- Fetches recent topics from database
- Compares new topics with existing ones
- Filters out duplicates (>60% word similarity)
- Ensures variety across posts

## Files Modified

### Updated Files
1. `backend/.env` - Configured for local development
2. `backend/lib/aiTextClient.js` - Enhanced error handling

### New Files
1. `backend/scripts/verify-posts-columns.js` - Database verification
2. `backend/FIX-OLLAMA-502-HOSTED.md` - Ollama documentation
3. `backend/FIXES-APPLIED.md` - This file

### Existing Files (Already Present)
1. `backend/mysql/add_topic_and_post_type.sql` - Migration SQL
2. `backend/scripts/migrate-add-topic-columns.js` - Migration script
3. `backend/FIX-502-BATCH-TEXT-POSTS.md` - Original fix doc

## Summary

All fixes have been applied successfully:

✅ Database migrated (topic and post_type columns added)
✅ Error handling improved (better diagnostics)
✅ Configuration set for local development with Ollama
✅ Documentation created for production deployment
✅ Verification scripts created

**Status:** Ready to test locally. Remember to update `.env` before deploying to production.
