# AI-Powered Category Suggestions

This application supports optional AI-powered category suggestions using [Google Gemini](https://ai.google.dev/) (free tier). This provides **cloud-based, zero-cost** AI categorization for transactions.

## Features

- **Free**: Google Gemini free tier (15 requests/min, 1M tokens/month)
- **Fast**: Gemini 2.0 Flash is optimized for speed (~0.85 confidence)
- **Serverless**: Works on Vercel without any local infrastructure
- **Graceful Fallback**: If AI fails or is disabled, falls back to rule-based categorization

## Setup Instructions

### 1. Get a Google AI API Key (Free)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

### 2. Add to Environment Variables

**For Vercel deployment:**
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add: `GEMINI_API_KEY` = `your-api-key-here`

**For local development:**
Create/edit `.env.local`:
```bash
GEMINI_API_KEY=your-api-key-here
```

### 3. That's It!

The app will automatically use AI categorization when the API key is present. No other configuration needed.

## How It Works

When a transaction is created without a category, the system tries:

1. **Manual** - User-assigned category (confidence: 1.0)
2. **Merchant Rule** - Exact merchant match (confidence: 0.95)
3. **Keyword Rule** - Keyword in description (confidence: 0.80)
4. **Regex Rule** - Pattern match (confidence: 0.75)
5. **🤖 AI Suggestion** - Gemini AI analysis (confidence: ~0.85) ✨
6. **Fallback** - Default category (confidence: 0.50)

## Auto-Learning Rules 🧠

When the AI categorizes a transaction with **≥75% confidence**, the system automatically creates a categorization rule. This means:

- **First time**: AI analyzes "Shufersal" → Groceries (0.82 confidence) → Creates merchant rule
- **Second time**: Rule matches instantly, no AI call needed

This reduces API calls over time and speeds up categorization. Rules are created as:
- **Merchant rule** - If transaction has a merchant name
- **Keyword rule** - Extracts the most meaningful word from description

All auto-created rules are marked with `createdFrom: 'ai_suggestion'` and can be reviewed/edited in the Rules settings.

## AI Prompt Structure

The AI receives:
- Transaction description (including Hebrew text)
- Merchant name
- Amount & direction (income/expense)
- List of available categories

And responds with:
```json
{
  "categoryId": "cat-groceries",
  "confidence": 0.85,
  "reasoning": "Rami Levy is a supermarket chain"
}
```

## Free Tier Limits

Google Gemini free tier is very generous:
- **15 requests per minute**
- **1,500 requests per day**
- **1 million tokens per month**

For a single-user budget app, you'll never hit these limits even with hundreds of transactions.

## Performance

- **Response Time**: 500-1500ms per transaction
- **Model**: Gemini 2.0 Flash (fast & accurate)
- **Timeout**: 10 seconds (falls back if exceeded)

## Troubleshooting

### API Key Not Working
```
Error: Gemini API returned status 400
```
**Solution**: Verify your API key is correct and not expired at [Google AI Studio](https://aistudio.google.com/apikey)

### Rate Limit Exceeded
```
Error: Gemini API returned status 429
```
**Solution**: Wait a minute and try again. For batch operations, the app processes transactions sequentially to avoid rate limits.

### Disable AI
Simply remove or leave empty the `GEMINI_API_KEY` environment variable.

## Alternatives

If you prefer a different provider:

### OpenAI (GPT-4o-mini)
Very cheap (~$0.0001 per transaction) but requires billing setup.

### Local Ollama (Previous Setup)
If you want to run AI locally for privacy:
1. Install [Ollama](https://ollama.ai/)
2. Run `ollama serve` and `ollama pull llama3.2:3b`
3. Modify `ai-categorization.ts` to use Ollama API

## Privacy & Security

✅ **Minimal data sent** - Only transaction description, merchant, amount, direction
✅ **No personal info** - Account numbers, balances never sent to AI
✅ **HTTPS only** - All API calls encrypted
✅ **Graceful degradation** - App works fine with AI disabled

## Resources

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Free Tier Pricing](https://ai.google.dev/pricing)
