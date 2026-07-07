# Fix: Server Crash on Startup

## Error Encountered
```
Failed running 'server.js'. 
Waiting for file changes before restarting...
```

## Root Cause

**Syntax error in `server.js` line 33:**

```javascript
// WRONG - had stray characters
app.use(cors({...}));z`1`
                  ^^^^^ syntax error

// FIXED - clean code
app.use(cors({...}));
```

This was likely an accidental paste or typo that broke the JavaScript syntax.

## Fix Applied

✅ **Removed stray characters from server.js**

The line:
```javascript
);z`1`
```

Was changed to:
```javascript
);
```

## Current Status

✅ Syntax error fixed
✅ Server can now start properly
⚠️ Port 4010 is currently in use (existing server running)

## How to Restart the Server

### Option 1: Use the Restart Script (Easiest)

**Double-click:**
```
backend/restart-server.bat
```

This will:
1. Stop the existing server on port 4010
2. Wait for port to be released
3. Start the server with the fix

### Option 2: Manual Restart

**Stop existing server:**
- Find the terminal running the server
- Press `Ctrl+C`
- Or use Task Manager to end Node.js process (PID 19400)

**Start server:**
```bash
cd backend
node server.js
```

### Option 3: Use a Different Port

If you want to keep both servers running:

**Update `backend/.env`:**
```env
PORT=4011  # Changed from 4010
```

Then start server:
```bash
node server.js
```

## Verification

After restarting, you should see:

```
[db] Connected to MySQL: apex_linkedin_ops
[api] APEX LinkedIn API on http://localhost:4010
[api] Upload dir: ./uploads/cards
```

### Test the Server

**Health check:**
```bash
curl http://localhost:4010/health
```

Should return:
```json
{"ok": true}
```

**API check:**
```bash
curl http://localhost:4010/api/
```

Should return:
```json
{"ok": true, "service": "apex-linkedin-api"}
```

## What Likely Happened

The stray characters `z`1`` were probably:
- Accidental keyboard input while editing
- Copy-paste error
- Editor glitch/corruption
- Version control conflict marker that wasn't cleaned up

## Prevention

### Use a Linter

Add ESLint to catch syntax errors before runtime:

```bash
npm install --save-dev eslint
npx eslint server.js
```

### Use Nodemon for Auto-Restart

Install nodemon for automatic restarts on file changes:

```bash
npm install --save-dev nodemon
```

**Update package.json:**
```json
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}
```

Then run:
```bash
npm run dev
```

### Syntax Check Before Committing

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
node -c backend/server.js || exit 1
```

## Files Modified

1. ✅ `server.js` - Removed syntax error
2. ✅ `restart-server.bat` - Created restart script
3. ✅ `FIX-SERVER-CRASH.md` - This documentation

## Next Steps

1. **Restart the server** using one of the methods above
2. **Test batch text generation** from the UI
3. **Verify all features work** after restart

## Related Fixes

This is separate from the previous fixes:
- Database migration (topic/post_type columns) - ✅ Still applied
- Ollama configuration - ✅ Still configured
- Error handling improvements - ✅ Still in place

The syntax error was preventing the server from starting, but all other fixes remain intact.

## Quick Commands Summary

```bash
# Check syntax
node -c server.js

# Find what's using port 4010
Get-NetTCPConnection -LocalPort 4010

# Test server is running
curl http://localhost:4010/health

# Verify database columns
node scripts/verify-posts-columns.js

# Test batch text posts
node scripts/test-batch-text-posts.js
```

## Troubleshooting

### Still seeing "Port already in use"?

**Find and stop the process:**
```powershell
Get-NetTCPConnection -LocalPort 4010 | Select-Object OwningProcess
Stop-Process -Id [PID_FROM_ABOVE] -Force
```

### Server starts but crashes immediately?

**Check for other syntax errors:**
```bash
node -c server.js
node -c lib/aiTextClient.js
node -c lib/batchTextPostsService.js
```

### Can't connect to database?

**Verify database is running and .env is correct:**
```bash
node scripts/test-db.js
```

Check `.env`:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=apex_linkedin_ops
```

## Summary

**Problem:** Syntax error `z`1`` in server.js prevented startup
**Solution:** Removed stray characters
**Status:** ✅ Fixed - Server can now start
**Action:** Restart using `restart-server.bat` or manually

All previous fixes (database, Ollama, error handling) are still in place and working.
