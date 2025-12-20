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
}

export async function generatePost(options: GeneratePostOptions): Promise<string> {
  const { personaId, topic, context, isOpener = false, debateStance } = options;
  
  // Get persona
  const persona = await db
    .select()
    .from(personas)
    .where(eq(personas.id, personaId))
    .limit(1);
  
  if (!persona.length) {
    throw new Error('Persona not found');
  }
  
  const { name, personalityPrompt, temperature, maxTokens } = persona[0];
  
  // Build natural prompt
  let prompt = `${personalityPrompt}

---

NOW YOU'RE WRITING A FORUM POST.

DISCUSSION TOPIC: "${topic}"

`;

  if (debateStance) {
    prompt += `YOUR DEBATE ROLE: You're arguing ${debateStance === 'pro' ? 'IN FAVOR OF' : 'AGAINST'} this position.
Present strong arguments for your side. Be persuasive but fair.

`;
  }

  if (isOpener) {
    prompt += `THIS IS YOUR OPENING POST starting the discussion.

Tasks:
- Present the topic from YOUR perspective
- Share your experience/opinion
- Ask questions or throw out a provocative take to get others talking
- Write AS YOURSELF - with your verbal tics, style, emotions`;
  } else {
    prompt += `DISCUSSION SO FAR:
${context}

---

THIS IS YOUR REPLY to this discussion.

Tasks:
- Respond to what others said (you can agree OR disagree)
- Add your own perspective
- You can praise someone, criticize, ask questions
- Write AS YOURSELF - with your verbal tics, style, emotions
- DON'T repeat what's already been said`;
  }

  prompt += `

RULES (VERY IMPORTANT):
1. Write in ENGLISH like on a real forum (Reddit style)
2. NEVER write "As an AI" or "As ${name}" - just write
3. NEVER use asterisks for actions (*smiles*)
4. Your length: ${maxTokens < 600 ? 'keep it short, 100-200 words' : maxTokens < 750 ? 'medium length, 150-300 words' : 'can be longer, 200-400 words'}
5. You can have typos if that fits your character
6. Use YOUR slang and verbal tics
7. DON'T format perfectly - this is a forum, not an essay
8. BE YOURSELF - with your flaws and emotions

WRITE YOUR POST:`;

  const content = await complete(prompt, {
    tier: 'balanced',
    maxTokens: maxTokens || 800,
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
  ];
  
  for (const phrase of aiPhrases) {
    cleaned = cleaned.replace(phrase, '');
  }
  
  // Remove action asterisks
  cleaned = cleaned.replace(/\*[^*]+\*/g, '');
  
  // Remove "Post:" or "Response:" prefixes
  cleaned = cleaned.replace(/^(Post|Response|Reply):\s*/i, '');
  
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
  previousArguments?: string
): Promise<string> {
  return generatePost({
    personaId,
    topic,
    context: previousArguments,
    isOpener: !previousArguments,
    debateStance: stance,
  });
}
