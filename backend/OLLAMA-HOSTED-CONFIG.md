# Ollama Hosted Configuration Guide

This guide explains how to configure and use the separate Ollama Hosted configuration for advanced RAG and embedding features.

## Overview

The system now supports two separate Ollama configurations:

1. **Ollama Local** - For self-hosted models on the same machine or local network
2. **Ollama Hosted** - For publicly accessible or hosted Ollama endpoints with advanced features

## Configuration Options

### Ollama Local Configuration

Basic configuration for local Ollama instances:

- **Local URL**: `http://127.0.0.1:11434` or `http://localhost:11434`
- **Model**: Select from available models (e.g., `llama3.1:8b`, `qwen3:8b`)

### Ollama Hosted Configuration

Advanced configuration for hosted Ollama instances with RAG capabilities:

#### Base Settings

| Setting | Environment Variable | Default | Description |
|---------|---------------------|---------|-------------|
| **Hosted URL** | `OLLAMA_BASE_URL` | `http://10.100.0.1:11434` | URL of the hosted Ollama server |
| **Default Model** | `DEFAULT_AI_MODEL` | `qwen2.5:14b-instruct` | Primary AI model for text generation |

#### Embedding Configuration

| Setting | Environment Variable | Default | Description |
|---------|---------------------|---------|-------------|
| **Embedding Model** | `EMBEDDING_MODEL` | `nomic-embed-text` | Model for generating text embeddings |
| **Embedding Dimension** | `EMBEDDING_DIM` | `768` | Dimension size of embedding vectors |

#### Specialized Models

| Setting | Environment Variable | Default | Description |
|---------|---------------------|---------|-------------|
| **Question Model** | `QUESTION_GENERATION_MODEL` | `qwen2.5:14b-instruct` | Model for generating questions |
| **Analysis Model** | `ANALYSIS_AI_MODEL` | `qwen2.5:14b-instruct` | Model for content analysis |

#### Performance Settings

| Setting | Environment Variable | Default | Description |
|---------|---------------------|---------|-------------|
| **Num GPU** | `OLLAMA_NUM_GPU` | `0` | Number of GPUs to use (0 = CPU only) |
| **Context Size** | `OLLAMA_NUM_CTX` | `8192` | Maximum context window size |
| **Timeout** | `OLLAMA_CHAT_TIMEOUT_MS` | `900000` | Chat timeout in milliseconds (15 minutes) |

#### RAG Settings

| Setting | Environment Variable | Default | Description |
|---------|---------------------|---------|-------------|
| **RAG Top K** | `RAG_TOP_K` | `5` | Number of top results to retrieve for RAG |

## Setup Instructions

### Method 1: Database Configuration (Recommended)

1. Navigate to **Admin → AI Configuration**
2. Scroll to the **Ollama (Hosted)** section
3. Enter your hosted Ollama URL (e.g., `http://10.100.0.1:11434`)
4. Configure the advanced settings as needed
5. Click **Save changes**

### Method 2: Environment Variables

Add these variables to your `.env` file:

```bash
# Ollama Hosted Base URL
OLLAMA_BASE_URL=http://10.100.0.1:11434

# Model Configuration
DEFAULT_AI_MODEL=qwen2.5:14b-instruct
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIM=768
QUESTION_GENERATION_MODEL=qwen2.5:14b-instruct
ANALYSIS_AI_MODEL=qwen2.5:14b-instruct

# Performance Settings
OLLAMA_NUM_GPU=0
OLLAMA_NUM_CTX=8192
OLLAMA_CHAT_TIMEOUT_MS=900000

# RAG Settings
RAG_TOP_K=5
```

### Method 3: Database Migration

Run the migration script to add the necessary database columns:

```bash
node scripts/migrate-ollama-hosted-config.js
```

Or manually run the SQL migration:

```bash
mysql -u root -p apex_linkedin_ops < mysql/add_ollama_hosted_config.sql
```

## Provider Selection

Set the `AI_PROVIDER` to control which Ollama instance is used:

- `auto` - Try all configured providers in order (Gemini → OpenAI → Ollama Local → Ollama Hosted)
- `ollama-local` - Use only Ollama Local configuration
- `ollama-hosted` - Use only Ollama Hosted configuration
- `ollama` - Use any configured Ollama instance

Example:

```bash
AI_PROVIDER=ollama-hosted
```

Or set it in **Admin → AI Configuration → Default provider order**

## Features Enabled by Ollama Hosted

When using Ollama Hosted configuration, you get access to:

- **RAG (Retrieval Augmented Generation)** - Enhanced context retrieval
- **Embedding Support** - Vector embeddings for semantic search
- **Question Generation** - Automatic question generation from content
- **Content Analysis** - Advanced content analysis capabilities
- **GPU Acceleration** - Optional GPU support for faster inference
- **Extended Context** - Configurable context window size
- **Batch Processing** - Optimized for batch text post generation

## Troubleshooting

### Connection Issues

If you can't connect to your hosted Ollama instance:

1. Verify the URL is accessible from your server
2. Check firewall rules allow connections to the Ollama port (default: 11434)
3. Ensure the Ollama service is running on the host
4. Test the connection: `curl http://your-host:11434/api/tags`

### Performance Issues

If inference is slow:

1. Increase `OLLAMA_NUM_GPU` if GPUs are available
2. Reduce `OLLAMA_NUM_CTX` for faster responses
3. Consider using a smaller model (e.g., `qwen2.5:7b` instead of `14b`)
4. Increase `OLLAMA_CHAT_TIMEOUT_MS` for complex queries

### Timeout Errors

If you're getting timeout errors:

1. Increase `OLLAMA_CHAT_TIMEOUT_MS` (current: 900000ms = 15 minutes)
2. Check server resources (CPU/GPU/Memory)
3. Monitor Ollama logs for issues
4. Consider using a faster model

## Best Practices

1. **Use Database Configuration** - Store settings in database for easy updates without redeployment
2. **Separate Local and Hosted** - Use local for development, hosted for production
3. **Monitor Performance** - Track response times and adjust settings accordingly
4. **GPU Allocation** - Set `OLLAMA_NUM_GPU` based on available hardware
5. **Context Window** - Balance between quality and performance with `OLLAMA_NUM_CTX`
6. **Fallback Providers** - Configure multiple providers for redundancy

## Example Configurations

### Development Setup (Local)

```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
AI_PROVIDER=ollama-local
```

### Production Setup (Hosted with RAG)

```bash
OLLAMA_BASE_URL=http://10.100.0.1:11434
DEFAULT_AI_MODEL=qwen2.5:14b-instruct
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIM=768
QUESTION_GENERATION_MODEL=qwen2.5:14b-instruct
ANALYSIS_AI_MODEL=qwen2.5:14b-instruct
OLLAMA_NUM_GPU=1
OLLAMA_NUM_CTX=8192
OLLAMA_CHAT_TIMEOUT_MS=900000
RAG_TOP_K=5
AI_PROVIDER=ollama-hosted
```

### High-Performance Setup (Multiple GPUs)

```bash
OLLAMA_BASE_URL=http://gpu-server.internal:11434
DEFAULT_AI_MODEL=qwen2.5:14b-instruct
OLLAMA_NUM_GPU=2
OLLAMA_NUM_CTX=16384
OLLAMA_CHAT_TIMEOUT_MS=1800000
AI_PROVIDER=ollama-hosted
```

## Support

For issues or questions:

1. Check the Ollama logs on your host server
2. Review the backend logs: `node scripts/check-logs.js`
3. Verify database settings in **Admin → AI Configuration**
4. Test API connectivity: `curl http://your-host:11434/api/tags`

## Additional Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Model Library](https://ollama.com/library)
- [RAG Best Practices](https://github.com/ollama/ollama/blob/main/docs/rag.md)
