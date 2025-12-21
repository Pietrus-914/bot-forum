import OpenAI from 'openai';

// Available models through OpenRouter - VERIFIED DECEMBER 2024
export const AVAILABLE_MODELS = {
  // Anthropic
  'claude-sonnet': 'anthropic/claude-3.5-sonnet',
  'claude-haiku': 'anthropic/claude-3.5-haiku',
  // Meta
  'llama-70b': 'meta-llama/llama-3.1-70b-instruct',
  'llama-8b': 'meta-llama/llama-3.1-8b-instruct',
  // Mistral
  'mistral-large': 'mistralai/mistral-large',
  // Google - VERIFIED IDs
  'gemini-flash': 'google/gemini-2.0-flash-001',
  'gemini-pro': 'google/gemini-pro-1.5',
  // OpenAI
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  // Qwen
  'qwen-72b': 'qwen/qwen-2.5-72b-instruct',
};

// Model tiers for fallback
const MODEL_TIERS = {
  free: 'meta-llama/llama-3.1-8b-instruct:free',
  cheap: 'meta-llama/llama-3.1-8b-instruct',
  balanced: 'meta-llama/llama-3.1-70b-instruct',
  quality: 'anthropic/claude-3.5-sonnet',
};

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'AI Forum',
  },
});

export type ModelTier = keyof typeof MODEL_TIERS;
export type ModelKey = keyof typeof AVAILABLE_MODELS;

interface CompletionOptions {
  tier?: ModelTier;
  model?: string; // Direct model string
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function complete(
  prompt: string,
  options: CompletionOptions = {}
): Promise<string> {
  const {
    tier = 'balanced',
    model,
    maxTokens = 1000,
    temperature = 0.7,
    systemPrompt,
  } = options;

  // Use direct model if provided, otherwise use tier
  const modelToUse = model || MODEL_TIERS[tier];

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    console.log(`[AI] Using model: ${modelToUse}`);
    
    const response = await openrouter.chat.completions.create({
      model: modelToUse,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    const content = response.choices[0]?.message?.content || '';
    
    if (response.usage) {
      console.log(`[AI] ${modelToUse} - ${response.usage.total_tokens} tokens`);
    }

    return content;
  } catch (error: any) {
    console.error(`AI completion error (${modelToUse}):`, error.message);
    
    // Fallback to cheaper model on error
    if (model && tier !== 'free') {
      console.log('Falling back to tier model...');
      return complete(prompt, { ...options, model: undefined, tier: 'cheap' });
    }
    
    throw error;
  }
}

// Helper for JSON responses
export async function completeJSON<T>(
  prompt: string,
  options: CompletionOptions = {}
): Promise<T> {
  const result = await complete(
    prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, no code blocks.',
    options
  );
  
  let cleaned = result.trim();
  
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON:', cleaned);
    throw new Error('Invalid JSON response from AI');
  }
}

export { AVAILABLE_MODELS as MODELS };
