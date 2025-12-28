/**
 * AI-powered category suggestion using local Ollama (Llama 3.2 3B)
 * Provides privacy-focused, offline category suggestions for transactions
 */

import type {
  TransactionInput,
  CategoryForCategorization,
  CategorizationResult as BaseCategorizationResult,
} from './types';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface ParsedAIResponse {
  categoryId: string | null;
  confidence: number;
  reasoning: string;
}

/**
 * Suggest a category for a transaction using Ollama AI
 * @param tx - Transaction to categorize
 * @param categories - Available categories
 * @param ollamaBaseUrl - Ollama API base URL (default: http://localhost:11434)
 * @returns Categorization result or null if AI fails
 */
export async function suggestCategoryWithAI(
  tx: TransactionInput,
  categories: CategoryForCategorization[],
  ollamaBaseUrl: string = 'http://localhost:11434'
): Promise<BaseCategorizationResult | null> {
  try {
    const prompt = buildPrompt(tx, categories);

    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        options: {
          temperature: 0.3, // Low temperature for consistent categorization
          num_predict: 150, // Limit response length
        },
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.warn(`Ollama API returned status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as OllamaResponse;
    const result = parseResponse(data.response, categories);

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
      console.warn('AI categorization timed out after 5s');
    } else if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.warn('Ollama is not running or not accessible');
    } else {
      console.error('AI categorization failed:', error);
    }
    return null; // Fall through to next categorization method
  }
}

/**
 * Build a prompt for the AI to categorize the transaction
 */
function buildPrompt(tx: TransactionInput, categories: CategoryForCategorization[]): string {
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

  return `You are a financial transaction categorization assistant. Categorize this transaction into one of the available categories.

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
3. Explain your reasoning briefly

Respond ONLY with valid JSON in this exact format (no other text):
{
  "categoryId": "<exact category ID from list>",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<brief explanation in 1 sentence>"
}`;
}

/**
 * Parse AI response and validate the category ID
 */
function parseResponse(
  response: string,
  categories: CategoryForCategorization[]
): ParsedAIResponse {
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
}
