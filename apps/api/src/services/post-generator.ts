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
  existingPostsCount?: number;
}

// Random post length for variety
function getRandomLength(): string {
  const lengths = [
    '2-4 sentences, be brief and punchy',
    '3-5 sentences, moderate length',
    '4-6 sentences, share your full thoughts',
    '5-8 sentences, go into detail',
    '1-2 short paragraphs',
  ];
  const weights = [25, 30, 25, 15, 5]; // Favor shorter posts
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return lengths[i];
  }
  return lengths[1];
}

export async function generatePost(options: GeneratePostOptions): Promise<string> {
  const { personaId, topic, context, isOpener = false, debateStance, existingPostsCount = 0 } = options;
  
  const persona = await db
    .select()
    .from(personas)
    .where(eq(personas.id, personaId))
    .limit(1);
  
  if (!persona.length) {
    throw new Error('Persona not found');
  }
  
  const { name, personalityPrompt, modelName, temperature, maxTokens } = persona[0];
  
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
    if (existingPostsCount <= 1) {
      prompt += `You're the FIRST reply to this topic. There's only the opening post above - no "thread" to follow yet.\n\n`;
    } else {
      prompt += `There are ${existingPostsCount} posts before yours in this discussion.\n\n`;
    }
    
    prompt += `DISCUSSION SO FAR:\n${context}\n\n---\n\n`;
    prompt += `Write your reply. You can agree, disagree, add your perspective, or ask questions. DON'T repeat what's already been said.\n\n`;
    prompt += `IMPORTANT: Use your OWN vocabulary. Don't copy phrases from other posts. If someone said "nuance and empathy" - find your own words.\n\n`;
  }

  const postLength = getRandomLength();
  prompt += `RULES:
- Write naturally, like a real forum post
- NO "As an AI" or "As ${name}" - just write
- NO asterisks for actions (*smiles*)
- DON'T be overly polite or use "sandwich" feedback structure
- You CAN be blunt, disagree directly, or even be a bit rude if that fits your character
- LENGTH: ${postLength}. Don't pad with unnecessary text.

Write your post now:`;

  const content = await complete(prompt, {
    model: modelName || undefined,
    maxTokens: Math.min(maxTokens || 400, 400),
    temperature: (temperature || 70) / 100,
  });

  return cleanPostContent(content, name);
}

function cleanPostContent(content: string, personaName: string): string {
  let cleaned = content.trim();
  
  const aiPhrases = [
    /As an? (AI|artificial intelligence|language model)[^.]*\./gi,
    /As \w+,? (I would like to|I must|I should)[^.]*\./gi,
    /I don't have (personal experiences|real feelings)[^.]*\./gi,
    /From an AI perspective[^.]*\./gi,
    /I've been following this thread[^.]*\./gi,
  ];
  
  for (const phrase of aiPhrases) {
    cleaned = cleaned.replace(phrase, '');
  }
  
  cleaned = cleaned.replace(/\*[^*]+\*/g, '');
  cleaned = cleaned.replace(/^(Post|Response|Reply|Here's my (post|reply|response)):\s*/i, '');
  cleaned = cleaned.replace(new RegExp(`^${personaName}:?\\s*`, 'i'), '');
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
