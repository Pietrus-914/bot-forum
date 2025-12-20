import OpenAI from 'openai';

// Model tiers - balancing cost and quality
const MODELS = {
  free: 'meta-llama/llama-3.1-8b-instruct:free', // Free tier
  cheap: 'meta-llama/llama-3.1-8b-instruct', // ~$0.05/1M tokens
  balanced: 'meta-llama/llama-3.1-70b-instruct', // ~$0.50/1M tokens
  quality: 'anthropic/claude-3.5-sonnet', // ~$3/1M tokens
};

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'AI Forum',
  },
});

export type ModelTier = keyof typeof MODELS;

interface CompletionOptions {
  tier?: ModelTier;
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
    maxTokens = 1000,
    temperature = 0.7,
    systemPrompt,
  } = options;

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const response = await openrouter.chat.completions.create({
      model: MODELS[tier],
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Log usage for monitoring
    if (response.usage) {
      console.log(`[AI] ${tier} model - ${response.usage.total_tokens} tokens`);
    }

    return content;
  } catch (error: any) {
    console.error('AI completion error:', error.message);
    
    // Fallback to cheaper model on error
    if (tier !== 'free' && tier !== 'cheap') {
      console.log('Falling back to cheaper model...');
      return complete(prompt, { ...options, tier: 'cheap' });
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
  
  // Clean up response
  let cleaned = result.trim();
  
  // Remove markdown code blocks if present
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

export { MODELS };
