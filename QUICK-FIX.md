# Quick Fix: 502 Error on Batch Text Posts

## The Issue
❌ `api/ai/batch-text-posts` returns 502 error: "Unknown column 'topic' in 'SELECT'"

## The Fix (Choose One)

### Option 1: Run Migration Script (Recommended)
```bash
cd backend
node scripts/migrate-add-topic-columns.js
```

### Option 2: Run SQL Manually

**Local Database:**
```bash
mysql -u root apex_linkedin_ops < backend/mysql/add_topic_and_post_type.sql
```

**Production Database (via cPanel/phpMyAdmin):**
1. Log in to phpMyAdmin at your hosting control panel
2. Select database: `legatolx_marketing`
3. Go to SQL tab
4. Copy and paste contents of `backend/mysql/add_topic_and_post_type.sql`
5. Click "Go"

### Option 3: Use MySQL Command Line for Production
```bash
mysql -u legatolx_marketing -p legatolx_marketing < backend/mysql/add_topic_and_post_type.sql
# Password: admin@Byline25
```

## What Was Fixed

### Files Changed:
1. ✅ `backend/lib/batchTextPostsService.js` - Added fallback for missing columns
2. ✅ `backend/lib/repository.js` - Now populates topic and post_type
3. ✅ Created migration: `backend/mysql/add_topic_and_post_type.sql`
4. ✅ Created script: `backend/scripts/migrate-add-topic-columns.js`

### What the Migration Does:
- Adds `topic` column to `posts` table
- Adds `post_type` column to `posts` table
- Backfills existing data from `visual_cards`
- Safe to run multiple times

## Verify It Works

After running the migration, test in your app:
1. Go to "Create post" → "Batch text posts"
2. Select a company profile
3. Choose number of posts
4. Click "Generate 2 text posts"
5. Should work without 502 error ✅

## Need Help?

Read the detailed guide: `backend/FIX-502-BATCH-TEXT-POSTS.md`
