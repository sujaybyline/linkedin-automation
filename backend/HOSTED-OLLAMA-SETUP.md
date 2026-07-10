# Hosted Ollama Setup Guide

## Overview

This project now supports hosted Ollama instances with Bearer token authentication. The setup has been simplified to work with any hosted Ollama API that follows the standard Ollama API format.

## Configuration

### Your Hosted Ollama Details (from screenshot)
- **Base URL**: `https://ai.aimlworld-portal.cloud`
- **API Endpoint**: `/api/ai/chat` (automatically appended)
- **Authentication**: Bearer token in `Authorization` header
- **API Key**: `gw_74ccb4c29c17c020502ee48f535e72e9d7fa737973f975f0f9`

### How It Works

1. **URL Configuration**: The base URL is stored without the `/api/chat` suffix
2. **API Key**: Stored separately and added as `Authorization: Bearer {key}` header
3. **Automatic Detection**: The system automatically detects if a URL is local (localhost/127.0.0.1) or hosted

## Setup Methods

### Method 1: Environment Variables (.env file)

Edit `backend/.env`:

```env
# Hosted Ollama Configuration
OLLAMA_BASE_URL=https://ai.aimlworld-portal.cloud
OLLAMA_API_KEY=gw_74ccb4c29c17c020502ee48f535e72e9d7fa737973f975f0f9
OLLAMA_MODEL=qwen2.5:14b-instruct
```

### Method 2: Database Migration Script

Run the migration script to save settings to the database:

```bash
cd backend
node scripts/migrate-ollama-api-key.js
```

This will:
- Set the Ollama base URL to your hosted instance
- Save the API key securely in the database
- Update the default model

### Method 3: Admin UI

1. Navigate to **Admin → AI Configuration**
2. Find the **Ollama (Hosted)** card
3. Fill in:
   - **Hosted URL**: `https://ai.aimlworld-portal.cloud`
   - **API Key**: Your gateway API key (starts with `gw_`)
   - **Model**: `qwen2.5:14b-instruct` (or any available model)
4. Click **Save changes**

## Features

### Simplified Configuration
- No need for complex RAG/embedding settings for basic usage
- Just provide URL and API key
- Works with standard Ollama API format

### Automatic Bearer Token Authentication
- API key is automatically sent as `Authorization: Bearer {key}` header
- Only applied for hosted URLs (not localhost)
- Backwards compatible with local Ollama (no auth)

### Provider Selection
You can force the system to use hosted Ollama by setting:
```env
AI_PROVIDER=ollama-hosted
```

Or select it in the Admin UI under "Default provider order"

## Testing

### Using Postman (as shown in screenshot)
```
POST https://ai.aimlworld-portal.cloud/api/ai/chat

Headers:
- Authorization: Bearer gw_74ccb4c29c17c020502ee48f535e72e9d7fa737973f975f0f9
- Content-Type: application/json

Body:
{
  "model": "qwen2.5:14b-instruct",
  "messages": [
    {
      "role": "user",
      "content": "What is Python?"
    }
  ]
}
```

### Testing in the Application
1. Go to **Content → Fetch Info** or **Generate Captions**
2. The system will automatically use your hosted Ollama
3. Check logs for connection status

## Troubleshooting

### 502 Bad Gateway
- Verify the hosted Ollama service is running
- Check if the API key is correct
- Ensure the URL is accessible from your server

### Authentication Errors
- Confirm the API key starts with `gw_`
- Check if the key has been properly saved (not masked in UI)
- Verify the Authorization header format

### Model Not Found
- Ensure the model name matches exactly what's available on your hosted instance
- Check model availability with Ollama API: `GET /api/tags`

## Code Changes Summary

### Backend Changes
1. **aiTextClient.js**: Added Bearer token authentication for hosted Ollama
2. **aiProvider.js**: Added `ollamaApiKey` to provider slots
3. **aiConfig.js**: Added `ollama_api_key` configuration field
4. **.env**: Updated with hosted URL and API key

### Frontend Changes
1. **AiConfigPage.tsx**: Added API key input field for Ollama (Hosted)
2. Added key status indicator
3. Added helper text for authentication

### Database
- Uses existing `app_settings` table (key-value store)
- New setting: `ollama_api_key`
- Migration script: `migrate-ollama-api-key.js`

## Security Notes

1. **API Key Storage**: Keys are stored in the database, not in code
2. **Masked Display**: API keys are masked in the UI (shows only first/last 4 chars)
3. **Environment Fallback**: If not in DB, falls back to `.env` file
4. **HTTPS Recommended**: Always use HTTPS for hosted endpoints

## Next Steps

1. ✅ Run the migration script or update via UI
2. ✅ Test the connection with a simple caption generation
3. ✅ Monitor logs for any connection issues
4. ✅ Consider setting `AI_PROVIDER=ollama-hosted` for consistent usage

## Support

If you encounter issues:
1. Check server logs: `backend/logs/`
2. Verify network connectivity to hosted Ollama
3. Test the API key directly in Postman
4. Review the error messages in the UI

---

**Note**: The old complex Ollama Hosted configuration with RAG settings is still available but not required for basic usage. You only need URL + API Key for most use cases.
