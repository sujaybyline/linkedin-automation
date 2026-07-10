# Quick Test Guide - Hosted Ollama

## ✅ Configuration Already Applied

Your hosted Ollama is already configured with:
- **URL**: `https://ai.aimlworld-portal.cloud`
- **API Key**: Set in database (gw_74cc...f0f9)
- **Model**: `qwen2.5:14b-instruct`

## Quick Test Commands

### 1. Restart Server
```bash
cd backend
npm start
```

### 2. Test via API (using curl)
```bash
# Test the AI config endpoint
curl http://localhost:4010/api/settings/ai

# Should show ollama_api_key_set: true
```

### 3. Test via Frontend
1. Open http://localhost:5173 (or your frontend URL)
2. Go to **Admin → AI Configuration**
3. Look for "Ollama (Hosted)" card
4. Should show:
   - API Key: `gw_7••••••••f0f9` (masked)
   - Status: Database ✓

### 4. Test AI Generation
Try one of these features:
- **Fetch Info**: Enter a URL and click "Fetch Info"
- **Generate Caption**: Upload an image and generate a caption
- **Batch Posts**: Create batch text posts

## Expected Request Format

When your app makes a request to hosted Ollama:

```javascript
POST https://ai.aimlworld-portal.cloud/api/chat

Headers:
  Authorization: Bearer gw_74ccb4c29c17c020502ee48f535e72e9d7fa737973f975f0f9
  Content-Type: application/json

Body:
{
  "model": "qwen2.5:14b-instruct",
  "stream": false,
  "options": {
    "temperature": 0.5,
    "num_predict": 4096
  },
  "messages": [
    {
      "role": "user",
      "content": "Your prompt here"
    }
  ]
}
```

## Verification Checklist

- [x] Database migrated (ollama_api_key added)
- [x] .env updated with hosted URL and API key
- [x] Code updated to use Bearer authentication
- [x] Frontend UI updated with API key field
- [ ] Server restarted (do this now)
- [ ] Tested AI generation in UI
- [ ] Verified logs show successful connection

## Troubleshooting

### If you get "502 Bad Gateway"
```bash
# Check if the hosted Ollama URL is accessible
curl -I https://ai.aimlworld-portal.cloud/api/chat
```

### If you get "Authentication Failed"
```bash
# Verify the API key is correct in database
cd backend
node -e "
const db = require('./db');
db.query('SELECT setting_value FROM app_settings WHERE setting_key = ?', ['ollama_api_key'])
  .then(([rows]) => console.log('API Key:', rows[0]?.setting_value || 'NOT SET'))
  .finally(() => process.exit());
"
```

### Check Logs
```bash
# View recent logs
cd backend
node scripts/check-logs.js
```

## Force Hosted Ollama Usage

If you want to always use hosted Ollama:

**Method 1: Environment Variable**
```env
AI_PROVIDER=ollama-hosted
```

**Method 2: Admin UI**
1. Go to Admin → AI Configuration
2. Find "Default provider order" dropdown
3. Select "Ollama (Hosted) only"
4. Click Save

## Success Indicators

✅ **You'll know it's working when:**
1. No 502 errors in console
2. AI features (Fetch Info, Captions) work
3. Logs show "source: ollama" in responses
4. No "cannot connect to Ollama" errors

## Still Having Issues?

1. **Check Network**: Can your server reach `ai.aimlworld-portal.cloud`?
2. **Verify API Key**: Is it exactly as shown in Postman?
3. **Check Model**: Is `qwen2.5:14b-instruct` available on your hosted instance?
4. **Review Logs**: Look for specific error messages

## Rollback Command (if needed)

```bash
cd backend
node -e "
const db = require('./db');
db.query('UPDATE app_settings SET setting_value = ? WHERE setting_key = ?', ['http://127.0.0.1:11434', 'ollama_base_url'])
  .then(() => db.query('DELETE FROM app_settings WHERE setting_key = ?', ['ollama_api_key']))
  .then(() => console.log('Rolled back to local Ollama'))
  .finally(() => process.exit());
"
```

---

**Ready!** Just restart your server and test.
