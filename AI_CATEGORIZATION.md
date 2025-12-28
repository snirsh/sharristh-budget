# AI-Powered Category Suggestions

This application supports optional AI-powered category suggestions using [Ollama](https://ollama.ai/) with Llama 3.2 3B model. This provides **privacy-focused, offline** AI categorization for transactions.

## Features

- **Local & Private**: All AI processing happens on your machine
- **Offline**: No internet connection required after initial setup
- **Fast**: Llama 3.2 3B is optimized for speed (~0.85 confidence)
- **Graceful Fallback**: If AI fails or is disabled, falls back to rule-based categorization

## Setup Instructions

### 1. Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from [ollama.ai/download](https://ollama.ai/download)

### 2. Start Ollama Service

```bash
ollama serve
```

This starts the Ollama API server on `http://localhost:11434`

### 3. Pull the Model

Download Llama 3.2 3B (3.5GB):
```bash
ollama pull llama3.2:3b
```

This is a one-time download.

### 4. Test the Setup

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "prompt": "Categorize this expense: Starbucks coffee ₪25",
  "stream": false
}'
```

You should get a JSON response.

### 5. Enable in Application

Edit your `.env.local` file:
```bash
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

Restart the dev server:
```bash
pnpm dev:web
```

## How It Works

When a transaction is created without a category, the system tries:

1. **Manual** - User-assigned category (confidence: 1.0)
2. **Merchant Rule** - Exact merchant match (confidence: 0.95)
3. **Keyword Rule** - Keyword in description (confidence: 0.80)
4. **Regex Rule** - Pattern match (confidence: 0.75)
5. **🤖 AI Suggestion** - Ollama AI analysis (confidence: ~0.85) ✨
6. **Fallback** - Default category (confidence: 0.50)

## AI Prompt Structure

The AI receives:
- Transaction description
- Merchant name
- Amount & direction (income/expense)
- List of available categories (bilingual: "English (עברית)")

And responds with:
```json
{
  "categoryId": "cat-groceries",
  "confidence": 0.85,
  "reasoning": "Starbucks is a coffee shop, categorized as Restaurants"
}
```

## Performance

- **Response Time**: 200-500ms per transaction
- **Model Size**: 3.5GB (one-time download)
- **Memory Usage**: ~4GB RAM while running
- **Timeout**: 5 seconds (falls back if exceeded)

## Troubleshooting

### Ollama Not Running
```
Error: ECONNREFUSED
```
**Solution**: Start Ollama with `ollama serve`

### Model Not Found
```
Error: model 'llama3.2:3b' not found
```
**Solution**: Pull the model with `ollama pull llama3.2:3b`

### Slow Responses
- Check system resources (CPU/RAM)
- Try a smaller model: `ollama pull llama3.2:1b` (faster, less accurate)
- Or use GPU acceleration if available

### Disable AI
Set in `.env.local`:
```bash
OLLAMA_ENABLED=false
```

## Alternative Models

You can use other Ollama models:

```bash
# Smaller, faster (1GB)
ollama pull llama3.2:1b
OLLAMA_MODEL=llama3.2:1b

# Larger, more accurate (7GB)
ollama pull llama3.1:8b
OLLAMA_MODEL=llama3.1:8b
```

## Privacy & Security

✅ **All AI processing is local** - no data sent to external services
✅ **Offline capable** - works without internet after setup
✅ **Open source** - Ollama and Llama models are fully open
✅ **Graceful degradation** - app works fine with AI disabled

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Llama 3.2 Model Card](https://ollama.ai/library/llama3.2)
- [Model Performance Comparison](https://ollama.ai/blog/llama-3.2)
