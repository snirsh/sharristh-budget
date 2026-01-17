/**
 * AI-powered category suggestion using Vercel AI SDK with AI Gateway
 * Provides reliable cloud-based AI categorization for transactions with structured output
 *
 * Uses Vercel AI Gateway for:
 * - Unified API across multiple providers (OpenAI, Anthropic, Google)
 * - Built-in rate limiting and error handling
 * - Type-safe structured output with Zod schemas
 */

import { z } from 'zod';
import type {
  CategorizationResult as BaseCategorizationResult,
  CategoryForCategorization,
  TransactionInput,
} from './types';

// Response schema for AI categorization using Zod
const categorizationResponseSchema = z.object({
  categoryId: z.string().describe('The exact category ID from the available categories'),
  confidence: z.number().min(0).max(1).describe('Confidence score between 0.0 and 1.0'),
  reasoning: z.string().describe('Brief explanation for the category selection'),
});

// Type inference for IDE support (used by generateObject at runtime)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _CategorizationResponse = z.infer<typeof categorizationResponseSchema>;

/**
 * Suggest a category for a transaction using Vercel AI SDK
 * Falls back to direct API call if AI SDK is not available
 *
 * @param tx - Transaction to categorize
 * @param categories - Available categories
 * @param apiKey - AI Gateway API key or legacy Gemini API key
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
    // Try Vercel AI Gateway first (if generateObject is available)
    const result = await categorizeWithVercelAI(tx, categories, apiKey);
    if (result) {
      return result;
    }

    // Fall back to direct API call (legacy Gemini)
    return await categorizeWithDirectAPI(tx, categories, apiKey);
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
 * Categorize using Vercel AI SDK with generateObject for structured output
 */
async function categorizeWithVercelAI(
  tx: TransactionInput,
  categories: CategoryForCategorization[],
  apiKey: string
): Promise<BaseCategorizationResult | null> {
  try {
    // Dynamically import AI SDK to avoid build issues if not installed
    const { generateObject } = await import('ai');
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');

    // Create the AI Gateway provider
    const gateway = createOpenAICompatible({
      name: 'vercel-ai-gateway',
      apiKey,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });

    // Build the prompt
    const prompt = buildPromptForVercel(tx, categories);

    // Generate structured output
    const { object } = await generateObject({
      model: gateway('anthropic/claude-sonnet-4'),
      schema: categorizationResponseSchema,
      prompt,
      maxTokens: 256,
    });

    // Validate that the category ID exists in our list
    const validCategory = categories.find((c) => c.id === object.categoryId);

    if (!validCategory) {
      console.warn(`AI returned invalid category ID: ${object.categoryId}`);
      // Try partial match
      const partialMatch = categories.find(
        (c) =>
          c.id.includes(object.categoryId) ||
          object.categoryId.includes(c.id) ||
          c.name.toLowerCase().includes(object.reasoning.toLowerCase())
      );

      if (partialMatch) {
        return {
          categoryId: partialMatch.id,
          confidence: Math.min(object.confidence * 0.8, 0.7),
          source: 'ai_suggestion',
          reason: `AI (partial match): ${object.reasoning}`,
          matchedRule: null,
        };
      }
      return null;
    }

    // Cap confidence at 0.85 (AI suggestions are good but not perfect)
    const cappedConfidence = Math.min(object.confidence, 0.85);

    return {
      categoryId: object.categoryId,
      confidence: cappedConfidence,
      source: 'ai_suggestion',
      reason: `AI: ${object.reasoning}`,
      matchedRule: null,
    };
  } catch (error) {
    // If AI SDK is not available or fails, return null to try fallback
    if (
      error instanceof Error &&
      (error.message.includes('Cannot find module') || error.message.includes('MODULE_NOT_FOUND'))
    ) {
      console.info('Vercel AI SDK not available, using direct API fallback');
      return null;
    }
    throw error;
  }
}

/**
 * Build prompt for Vercel AI SDK
 */
function buildPromptForVercel(
  tx: TransactionInput,
  categories: CategoryForCategorization[]
): string {
  // Group categories by type for better context
  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const relevantCategories = tx.direction === 'income' ? incomeCategories : expenseCategories;

  const categoryList = relevantCategories.map((c) => `- ${c.id}: ${c.name}`).join('\n');

  return `You are a financial transaction categorization assistant for a Hebrew/Israeli user. Categorize this transaction.

Transaction:
- Description: ${tx.description}
- Merchant: ${tx.merchant || 'Unknown'}
- Amount: ₪${tx.amount}
- Type: ${tx.direction}

Available Categories (choose from these EXACT IDs):
${categoryList}

IMPORTANT: The categoryId MUST be one of the exact IDs listed above (e.g., "cm123abc..."). 
Hebrew text in descriptions is common - understand them contextually.
Provide a confidence score (0.0-1.0) and brief reasoning in English.`;
}

/**
 * Fallback: Direct API call to Gemini (legacy method)
 */
async function categorizeWithDirectAPI(
  tx: TransactionInput,
  categories: CategoryForCategorization[],
  apiKey: string
): Promise<BaseCategorizationResult | null> {
  const prompt = buildLegacyPrompt(tx, categories);

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
          maxOutputTokens: 256,
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

  const result = parseLegacyResponse(responseText, categories);

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
}

/**
 * Build a prompt for legacy direct API call
 */
function buildLegacyPrompt(tx: TransactionInput, categories: CategoryForCategorization[]): string {
  // Group categories by type for better context
  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const relevantCategories = tx.direction === 'income' ? incomeCategories : expenseCategories;

  const categoryList = relevantCategories.map((c) => `- ${c.id}: ${c.name}`).join('\n');

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
}

type ParsedAIResponse = {
  categoryId: string | null;
  confidence: number;
  reasoning: string;
};

/**
 * Parse legacy API response and validate the category ID
 * Handles various malformed JSON cases from AI responses
 */
function parseLegacyResponse(
  response: string,
  categories: CategoryForCategorization[]
): ParsedAIResponse {
  try {
    // Clean up response - remove markdown code blocks if present
    const cleaned = response
      .replace(/```json?\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Extract JSON from response (AI might add extra text)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { categoryId: null, confidence: 0, reasoning: 'No JSON found' };
    }

    let jsonStr = jsonMatch[0];

    // Try to fix common JSON issues from truncated responses
    // Fix unterminated strings by finding incomplete string at end
    const lastQuoteIndex = jsonStr.lastIndexOf('"');
    const lastColonIndex = jsonStr.lastIndexOf(':');

    // If JSON ends abruptly, try to close it properly
    if (!jsonStr.endsWith('}')) {
      // Check if we're in the middle of a string value
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;

      if (openBraces > closeBraces) {
        // Try to salvage: close any open string and object
        if (lastQuoteIndex > lastColonIndex) {
          // We're likely in a string value, close it
          jsonStr = jsonStr + '"}';
        } else {
          // After a colon, incomplete value
          jsonStr = jsonStr + '""' + '}'.repeat(openBraces - closeBraces);
        }
      }
    }

    const parsed = JSON.parse(jsonStr) as {
      categoryId?: string;
      confidence?: number;
      reasoning?: string;
    };

    // Validate that the category ID exists in our list
    const isValidCategory = categories.some((c) => c.id === parsed.categoryId);

    if (!isValidCategory) {
      // Try to find a partial match (AI might return slightly different ID)
      const partialMatch = categories.find(
        (c) => c.id.includes(parsed.categoryId || '') || (parsed.categoryId || '').includes(c.id)
      );
      if (partialMatch) {
        return {
          categoryId: partialMatch.id,
          confidence: Math.min((parsed.confidence || 0.5) * 0.8, 0.7), // Lower confidence for partial match
          reasoning: parsed.reasoning || 'Partial match',
        };
      }

      return {
        categoryId: null,
        confidence: 0,
        reasoning: 'Invalid category ID returned',
      };
    }

    return {
      categoryId: parsed.categoryId || null,
      confidence:
        typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
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
}
