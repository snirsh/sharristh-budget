/**
 * AI-powered category suggestion using Google Gemini (free tier)
 * Provides cloud-based AI categorization for transactions
 * Free tier: 15 requests/minute, 1M tokens/month
 */

import type {
  TransactionInput,
  CategoryForCategorization,
  CategorizationResult as BaseCategorizationResult,
} from './types';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
};

type ParsedAIResponse = {
  categoryId: string | null;
  confidence: number;
  reasoning: string;
};

/**
 * Suggest a category for a transaction using Google Gemini AI
 * @param tx - Transaction to categorize
 * @param categories - Available categories
 * @param apiKey - Google AI API key
 * @returns Categorization result or null if AI fails
 */
export const suggestCategoryWithAI = async (
  tx: TransactionInput,
  categories: CategoryForCategorization[],
  apiKey?: string
): Promise<BaseCategorizationResult | null> => {
  if (!apiKey) {
    console.warn('AI categorization skipped: No API key provided');
    return null;
  }

  try {
    const prompt = buildPrompt(tx, categories);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1, // Very low for consistent categorization
            maxOutputTokens: 150,
          },
        }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Gemini API returned status ${response.status}: ${errorText}`);
      return null;
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
      console.warn(`Gemini API error: ${data.error.message}`);
      return null;
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      console.warn('Gemini returned empty response');
      return null;
    }

    const result = parseResponse(responseText, categories);

    if (!result.categoryId) {
      console.warn('AI did not return a valid category ID');
      return null;
    }

    // Cap confidence at 0.85 (AI suggestions are good but not perfect)
    const cappedConfidence = Math.min(result.confidence, 0.85);

    return {
      categoryId: result.categoryId,
      confidence: cappedConfidence,
      source: 'ai_suggestion',
      reason: `AI: ${result.reasoning}`,
      matchedRule: null,
    };
  } catch (error) {
    // Graceful degradation - log but don't fail
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn('AI categorization timed out after 10s');
    } else if (error instanceof Error && error.name === 'AbortError') {
      console.warn('AI categorization was aborted');
    } else {
      console.error('AI categorization failed:', error);
    }
    return null; // Fall through to next categorization method
  }
};

/**
 * Build a prompt for the AI to categorize the transaction
 */
const buildPrompt = (tx: TransactionInput, categories: CategoryForCategorization[]): string => {
  // Group categories by type for better context
  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter(
    (c) => c.type === 'expected' || c.type === 'varying'
  );

  const relevantCategories =
    tx.direction === 'income' ? incomeCategories : expenseCategories;

  const categoryList = relevantCategories
    .map((c) => `- ${c.id}: ${c.name}`)
    .join('\n');

  return `You are a financial transaction categorization assistant for a Hebrew/Israeli user. Categorize this transaction into one of the available categories.

Transaction:
- Description: ${tx.description}
- Merchant: ${tx.merchant || 'Unknown'}
- Amount: ₪${tx.amount}
- Type: ${tx.direction}

Available Categories:
${categoryList}

Instructions:
1. Choose the MOST appropriate category ID from the list above
2. Provide a confidence score between 0.0 and 1.0
3. Explain your reasoning briefly (in English)
4. Hebrew text in descriptions is common - understand them contextually

Respond ONLY with valid JSON in this exact format (no other text, no markdown):
{"categoryId": "<exact category ID from list>", "confidence": <number between 0.0 and 1.0>, "reasoning": "<brief explanation in 1 sentence>"}`;
};

/**
 * Parse AI response and validate the category ID
 */
const parseResponse = (
  response: string,
  categories: CategoryForCategorization[]
): ParsedAIResponse => {
  try {
    // Extract JSON from response (AI might add extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { categoryId: null, confidence: 0, reasoning: 'No JSON found' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      categoryId?: string;
      confidence?: number;
      reasoning?: string;
    };

    // Validate that the category ID exists in our list
    const isValidCategory = categories.some((c) => c.id === parsed.categoryId);

    if (!isValidCategory) {
      return {
        categoryId: null,
        confidence: 0,
        reasoning: 'Invalid category ID returned',
      };
    }

    return {
      categoryId: parsed.categoryId || null,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.warn('Failed to parse AI response:', error);
    return {
      categoryId: null,
      confidence: 0,
      reasoning: 'Parse error',
    };
  }
};
