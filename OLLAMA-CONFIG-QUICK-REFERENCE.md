# Ollama Configuration Quick Reference

## UI Updates

The AI Configuration page now has **two separate cards** for Ollama:

### 1. Ollama (Local)
For self-hosted models on your machine or local network.

**Configuration:**
- Local URL: `http://127.0.0.1:11434`
- Model selection dropdown (Qwen 3 8B, Llama 3.1 8B, etc.)

**Use for:**
- Development
- Testing
- Private/local deployments

---

### 2. Ollama (Hosted)
For publicly accessible or hosted Ollama endpoints with advanced RAG features.

**Configuration:**
- Hosted URL: `http://your-server-ip:11434`
- Default Model: Text input (e.g., `qwen2.5:14b-instruct`)
- Embedding Model: Text input (e.g., `nomic-embed-text`)
- Embedding Dimension: Text input (e.g., `768`)
- Question Generation Model: Text input
- Analysis Model: Text input
- RAG Top K: Number of results to retrieve
- Num GPU: GPU count (0 = CPU only)
- Context Size: Context window size (e.g., `8192`)
- Timeout: Request timeout in milliseconds

**Use for:**
- Production deployments
- RAG (Retrieval Augmented Generation)
- Embedding-based search
- Multi-model workflows
- GPU-accelerated inference

---

## Provider Selection Options

In the **Default provider order** dropdown:

- `Auto` - Try all configured providers
- `Gemini only` - Use only Google Gemini
- `OpenAI only` - Use only OpenAI
- **`Ollama (Local) only`** - Use only local Ollama
- **`Ollama (Hosted) only`** - Use only hosted Ollama
- `Any configured Ollama` - Use either local or hosted

---

## Environment Variables Reference

### Ollama Local
```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

### Ollama Hosted
```bash
OLLAMA_BASE_URL=http://10.100.0.1:11434
DEFAULT_AI_MODEL=qwen2.5:14b-instruct
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIM=768
QUESTION_GENERATION_MODEL=qwen2.5:14b-instruct
ANALYSIS_AI_MODEL=qwen2.5:14b-instruct
OLLAMA_NUM_GPU=0
OLLAMA_NUM_CTX=8192
OLLAMA_CHAT_TIMEOUT_MS=900000
RAG_TOP_K=5
```

---

## Migration Steps

1. **Run database migration:**
   ```bash
   node scripts/migrate-ollama-hosted-config.js
   ```

2. **Update .env file:**
   - Add Ollama Hosted variables (see above)
   - Or configure via UI (recommended)

3. **Restart server:**
   ```bash
   npm run dev
   ```

4. **Configure in UI:**
   - Go to Admin → AI Configuration
   - Scroll to Ollama sections
   - Fill in local and/or hosted settings
   - Save changes

---

## Key Differences

| Feature | Local | Hosted |
|---------|-------|--------|
| **Setup** | Simple URL + Model | Full RAG configuration |
| **Use Case** | Dev/Testing | Production/RAG |
| **Fields** | 2 fields | 11 fields |
| **GPU Support** | Auto | Configurable |
| **Embeddings** | No | Yes |
| **RAG** | No | Yes |
| **Context** | Default | Configurable |

---

## Benefits of Separate Configs

✅ **Clarity**: Clear distinction between simple and advanced setups
✅ **Flexibility**: Can configure both independently
✅ **RAG Features**: Full control over embedding and RAG settings
✅ **Performance**: Fine-tune GPU, context, and timeout per environment
✅ **Security**: Separate local dev from production hosted
