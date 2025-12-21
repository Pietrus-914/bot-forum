import { complete } from '../lib/ai-client.js';
import { db } from '../db/client.js';
import { personas } from '../db/schema.js';
import { eq } from 'drizzle-orm';

interface GeneratePostOptions {
  personaId: string;
  topic: string;
  context?: string;
  isOpener?: boolean;
  debateStance?: 'pro' | 'con';
  existingPostsCount?: number; // How many posts before this one
}

export async function generatePost(options: GeneratePostOptions): Promise<string> {
  const { personaId, topic, context, isOpener = false, debateStance, existingPostsCount = 0 } = options;
  
  // Get persona with model info
  const persona = await db
    .select()
    .from(personas)
    .where(eq(personas.id, personaId))
    .limit(1);
  
  if (!persona.length) {
    throw new Error('Persona not found');
  }
  
  const { name, personalityPrompt, modelName, temperature, maxTokens } = persona[0];
  
  // Build prompt based on context
  let prompt = personalityPrompt + '\n\n---\n\n';
  
  if (debateStance) {
    prompt += `DEBATE TOPIC: "${topic}"\n`;
    prompt += `YOUR POSITION: Argue ${debateStance === 'pro' ? 'IN FAVOR' : 'AGAINST'}.\n\n`;
  } else {
    prompt += `TOPIC: "${topic}"\n\n`;
  }

  if (isOpener) {
    prompt += `Write an opening post about this topic. Share your perspective, maybe ask a question or make a provocative point to get discussion going.\n\n`;
  } else {
    // Prevent "I've been following this thread" hallucination
    if (existingPostsCount <= 1) {
      prompt += `You're the FIRST reply to this topic. There's only the opening post above - no "thread" to follow yet.\n\n`;
    } else {
      prompt += `There are ${existingPostsCount} posts before yours in this discussion.\n\n`;
    }
    
    prompt += `DISCUSSION SO FAR:\n${context}\n\n---\n\n`;
    prompt += `Write your reply. You can agree, disagree, add your perspective, or ask questions. DON'T repeat what's already been said.\n\n`;
    
    // Prevent echo chamber
    prompt += `IMPORTANT: Use your OWN vocabulary. Don't copy phrases from other posts. If someone said "nuance and empathy" - find your own words.\n\n`;
  }

  // Anti-AI patterns
  prompt += `RULES:
- Write naturally, like a real forum post
- NO "As an AI" or "As ${name}" - just write
- NO asterisks for actions (*smiles*)
- DON'T be overly polite or use "sandwich" feedback structure
- You CAN be blunt, disagree directly, or even be a bit rude if that fits your character
- Length: ${maxTokens && maxTokens < 500 ? '100-200 words' : '150-300 words'}

Write your post now:`;

  const content = await complete(prompt, {
    model: modelName || undefined,
    maxTokens: maxTokens || 600,
    temperature: (temperature || 70) / 100,
  });

  return cleanPostContent(content, name);
}

function cleanPostContent(content: string, personaName: string): string {
  let cleaned = content.trim();
  
  // Remove AI-isms
  const aiPhrases = [
    /As an? (AI|artificial intelligence|language model)[^.]*\./gi,
    /As \w+,? (I would like to|I must|I should)[^.]*\./gi,
    /I don't have (personal experiences|real feelings)[^.]*\./gi,
    /From an AI perspective[^.]*\./gi,
    /I've been following this thread[^.]*\./gi, // Common hallucination
  ];
  
  for (const phrase of aiPhrases) {
    cleaned = cleaned.replace(phrase, '');
  }
  
  // Remove action asterisks
  cleaned = cleaned.replace(/\*[^*]+\*/g, '');
  
  // Remove "Post:" or "Response:" prefixes
  cleaned = cleaned.replace(/^(Post|Response|Reply|Here's my (post|reply|response)):\s*/i, '');
  
  // Remove persona name at the start if present
  cleaned = cleaned.replace(new RegExp(`^${personaName}:?\\s*`, 'i'), '');
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();
  
  return cleaned;
}

export async function generateDebateArgument(
  personaId: string,
  topic: string,
  stance: 'pro' | 'con',
  previousArguments?: string,
  roundNumber?: number
): Promise<string> {
  return generatePost({
    personaId,
    topic,
    context: previousArguments,
    isOpener: !previousArguments,
    debateStance: stance,
    existingPostsCount: roundNumber ? roundNumber * 2 : 0,
  });
}
