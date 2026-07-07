# Fix for Ollama 502 Error on Hosted Environment

## Problem

Ollama works perfectly on your local development machine but returns **502 Bad Gateway** errors when deployed to a hosted production environment.

**Error Message:**
```
Error: Ollama fetch failed
```

## Root Cause

The issue is in your `.env` configuration:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

### Why This Fails on Hosted Servers:

1. **`127.0.0.1` is localhost** - it always refers to the machine making the request
2. On your **local machine**: `127.0.0.1:11434` connects to Ollama running on your computer ✅
3. On **hosted server**: `127.0.0.1:11434` tries to connect to Ollama on the server itself ❌
4. **Result**: If Ollama isn't installed/running on the hosted server, you get connection refused → 502 error

## Solutions

### Option 1: Disable Ollama on Hosted (Recommended for Production)

Use cloud AI providers (Gemini, OpenAI) instead of Ollama in production:

**Update `.env`:**
```env
# Disable Ollama on hosted environment
OLLAMA_BASE_URL=
OLLAMA_MODEL=qwen3:8b

# Use cloud providers instead
AI_PROVIDER=auto  # or gemini/openai
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash-lite

OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

**Why this works:**
- Cloud APIs work from anywhere
- No need to run/maintain Ollama on your server
- Better reliability and scalability
- Your code already has fallback logic built-in

### Option 2: Run Ollama on the Hosted Server

If you need Ollama on production:

1. **Install Ollama on your hosted server:**
   ```bash
   # SSH into your server
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Start Ollama service
   ollama serve
   
   # Pull your model
   ollama pull qwen3:8b
   ```

2. **Keep `.env` the same:**
   ```env
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=qwen3:8b
   ```

**Considerations:**
- Requires significant RAM (8GB+ for 8B model)
- CPU inference is slow without GPU
- Needs to be running 24/7
- Consider using systemd service for auto-start

### Option 3: Remote Ollama Instance

Run Ollama on a separate server and connect via network:

1. **Setup Ollama on a dedicated server** (e.g., a GPU instance)

2. **Configure Ollama to accept external connections:**
   ```bash
   # On Ollama server
   OLLAMA_HOST=0.0.0.0:11434 ollama serve
   ```

3. **Update `.env` with network address:**
   ```env
   # Use public IP or domain
   OLLAMA_BASE_URL=http://your-ollama-server.com:11434
   # OR use LAN IP if on same network
   OLLAMA_BASE_URL=http://192.168.x.x:11434
   
   OLLAMA_MODEL=qwen3:8b
   ```

**Security Warning:**
- Don't expose Ollama to public internet without authentication
- Use VPN, firewall rules, or reverse proxy with auth
- Consider using HTTPS with nginx/caddy

### Option 4: Environment-Specific Configuration

Use different settings for local vs production:

**Create `.env.production`:**
```env
# Production - Use cloud providers only
OLLAMA_BASE_URL=
AI_PROVIDER=gemini
```

**Keep `.env` for local:**
```env
# Local - Use Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
AI_PROVIDER=ollama
```

**Load correct env file:**
```javascript
// In your startup script
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env';
require('dotenv').config({ path: envFile });
```


### Enhanced Error Messages

Updated `lib/aiTextClient.js` to provide clearer error context:

```javascript
// Now gives helpful feedback:
"Ollama connection failed (502 Bad Gateway). 
Is Ollama running at http://127.0.0.1:11434? 
Check OLLAMA_BASE_URL configuration. 
Use localhost/127.0.0.1 for local dev only."
```

### Automatic Fallback

Your code already has provider fallback logic in `batchTextPostsService.js`:

```javascript
// If Ollama fails, automatically tries other providers
const slots = await resolveProviderSlots(provider, { enableCrossFallback });
```

This means if Ollama is unavailable, it will use Gemini or OpenAI automatically (when `AI_PROVIDER=auto`).

1. **Local development** - Use Ollama (free, private, fast iteration)
2. **Hosted production** - Use cloud APIs (reliable, scalable, no maintenance)

**Update your production `.env`:**
```env
# Disable Ollama on hosted
OLLAMA_BASE_URL=

# Use cloud provider
AI_PROVIDER=gemini
GEMINI_API_KEY=your_actual_key
GEMINI_MODEL=gemini-2.5-flash-lite
```

**Keep local `.env` unchanged:**
```env
# Use Ollama locally
OLLAMA_BASE_URL=http://127.0.0.1:11434
AI_PROVIDER=ollama
```

## Testing the Fix

### Test 1: Verify Provider Selection
```bash
# Check which providers are available
curl http://localhost:4010/api/ai/providers
```

Should show available providers and whether Ollama is configured.

### Test 2: Generate Batch Posts
From your UI:
1. Select a company profile
2. Choose provider (Gemini/OpenAI if Ollama disabled)
3. Generate text posts
4. Should work without 502 errors

### Test 3: Check Logs
```bash
# On your server
tail -f /path/to/logs/app.log

# Should NOT see:
# "Ollama connection failed"
# "502 Bad Gateway"
```

## Common Mistakes

### ❌ Mistake 1: Using localhost in production
```env
# WRONG - doesn't work on hosted servers
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

### ❌ Mistake 2: Exposing Ollama without security
```bash
# DANGEROUS - allows anyone to use your Ollama
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

### ❌ Mistake 3: Not setting fallback provider
```env
# If Ollama fails and no other provider, requests fail
AI_PROVIDER=ollama  # Too rigid
OLLAMA_BASE_URL=http://127.0.0.1:11434
GEMINI_API_KEY=      # Empty
OPENAI_API_KEY=      # Empty
```

### ✅ Correct Approach
```env
# Flexible - tries Ollama first, falls back to others
AI_PROVIDER=auto
OLLAMA_BASE_URL=http://127.0.0.1:11434  # Local only
GEMINI_API_KEY=your_key                  # Always works
OPENAI_API_KEY=your_key                  # Backup
```

## Debugging Checklist

If you still see 502 errors:

- [ ] Verify `.env` is loaded correctly (check `process.env.OLLAMA_BASE_URL`)
- [ ] Confirm Ollama service is running (if using local Ollama)
- [ ] Test Ollama directly: `curl http://127.0.0.1:11434/api/tags`
- [ ] Check firewall rules (if using remote Ollama)
- [ ] Verify model is pulled: `ollama list`
- [ ] Check server logs for detailed error messages
- [ ] Ensure at least one cloud provider (Gemini/OpenAI) has valid API key

## Quick Reference

| Environment | Recommended OLLAMA_BASE_URL |
|-------------|----------------------------|
| Local Dev   | `http://127.0.0.1:11434`   |
| Hosted Prod | `` (empty - disable)       |
| Remote LAN  | `http://192.168.x.x:11434` |
| Remote Public | `https://ollama.example.com` (with auth) |

## Summary

The 502 error occurs because `127.0.0.1` references the local machine. On hosted servers, this points to the server itself where Ollama isn't running. The solution is either:

1. **Disable Ollama** on production and use cloud providers (recommended)
2. **Install Ollama** on your hosted server
3. **Use a remote** Ollama instance with proper network configuration

For most users, option 1 is best: use Ollama locally for development, cloud APIs for production.
