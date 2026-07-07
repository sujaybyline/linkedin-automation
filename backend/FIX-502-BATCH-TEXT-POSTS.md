# Fix for 502 Error on `/api/ai/batch-text-posts`

## Problem

The endpoint `/api/ai/batch-text-posts` was returning a **502 Bad Gateway** error with the message:

```
Error: Unknown column 'topic' in 'SELECT'
```

This occurred because the code was trying to query a `topic` column from the `posts` table that doesn't exist in the production database.

## Root Cause

The `batchTextPostsService.js` file queries recent topics to avoid duplicates:

```javascript
SELECT topic FROM posts 
WHERE company_profile_id = ? AND post_type = 'text_only'
```

However, your production database's `posts` table is missing:
- `topic` column
- `post_type` column

These columns are needed for the text post generation feature to work correctly.

## Solution

### 1. Apply Database Migration

Run the migration to add the missing columns:

```bash
# From the backend directory
node scripts/migrate-add-topic-columns.js
```

Or manually run the SQL:

```bash
# If using MySQL command line
mysql -u root -p apex_linkedin_ops < mysql/add_topic_and_post_type.sql
```

For production database:
```bash
mysql -u legatolx_marketing -p legatolx_marketing < mysql/add_topic_and_post_type.sql
```

### 2. Verify the Fix

After running the migration:

1. Check that columns exist:
   ```sql
   DESCRIBE posts;
   ```
   
   You should see:
   - `topic` VARCHAR(255) DEFAULT NULL
   - `post_type` ENUM('text_only', 'image', 'carousel') DEFAULT NULL

2. Test the endpoint by generating batch text posts from the UI

### 3. Code Changes Made

The following files were updated with backward-compatible code:

1. **`lib/batchTextPostsService.js`**
   - Added try-catch to handle missing `topic` column
   - Falls back to querying from `visual_cards` table if needed
   - Prevents 502 errors even if migration hasn't been run yet

2. **`lib/repository.js`**
   - Updated `insertPostBundle()` to accept `topic` and `postType` parameters
   - Updated `insertTextOnlyPost()` to populate these fields
   - Ensures new posts have proper metadata

## Migration Details

The migration SQL does the following:

1. **Adds columns** (if they don't exist):
   - `posts.topic` - stores the post topic/title
   - `posts.post_type` - identifies if it's text_only, image, or carousel

2. **Backfills data**:
   - Copies topics from `visual_cards` to `posts` for existing records
   - Sets `post_type` based on `storage_path` or `media_type`

3. **Safe to run multiple times** - uses `IF NOT EXISTS` clause

## Why It Worked Locally But Not in Production

Your local database likely had these columns because you were developing the feature, but the production database was never migrated to include them. This is a common issue when database migrations aren't tracked or applied consistently across environments.

## Prevention

To avoid this in the future:

1. Always version control your schema changes (SQL migration files)
2. Track which migrations have been applied to each environment
3. Consider using a migration tool like:
   - **Knex.js** - JavaScript migrations
   - **Flyway** - Java-based migrations
   - **Liquibase** - XML/SQL migrations

## Rollback (if needed)

If you need to rollback this change:

```sql
ALTER TABLE posts DROP COLUMN topic;
ALTER TABLE posts DROP COLUMN post_type;
```

Note: The code is backward-compatible, so it will work even without these columns (it just won't prevent duplicate topics).
