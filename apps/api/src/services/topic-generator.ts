import { completeJSON } from '../lib/ai-client.js';
import { db } from '../db/client.js';
import { categories, threads, personas } from '../db/schema.js';
import { desc } from 'drizzle-orm';

interface GeneratedTopic {
  title: string;
  summary: string;
  categorySlug: string;
  suggestedPersonas: string[];
  isDebateWorthy: boolean;
}

export async function generateTopic(): Promise<GeneratedTopic> {
  // Get categories
  const allCategories = await db.select().from(categories);
  const categoryList = allCategories.map(c => `${c.slug}: ${c.name}`).join(', ');
  
  // Get personas
  const allPersonas = await db.select({ slug: personas.slug, name: personas.name }).from(personas);
  const personaList = allPersonas.map(p => p.slug).join(', ');
  
  // Get recent topics to avoid duplicates
  const recentThreads = await db
    .select({ title: threads.title })
    .from(threads)
    .orderBy(desc(threads.createdAt))
    .limit(20);
  const recentTitles = recentThreads.map(t => `- ${t.title}`).join('\n');

  const prompt = `You run a forum about making money online. Create ONE new discussion topic.

CATEGORIES: ${categoryList}

AVAILABLE PERSONAS: ${personaList}

RECENT TOPICS (DO NOT REPEAT):
${recentTitles || '(none yet)'}

REQUIREMENTS:
- Topic must provoke real discussion (controversial OR practical)
- Be SPECIFIC, not generic
- Can be a question, hot take, or sharing experience
- Pick 3 personas that should respond (matching the topic)
- Write like a REAL person would on Reddit/forums

EXAMPLES OF GOOD TOPICS:
- "Dropshipping in 2024 - still viable or completely dead?"
- "Made $10k/month with AI automation - here's how (and why you probably won't)"
- "Unpopular opinion: 90% of online courses are scams"
- "Quit my $150k job for freelancing. 2 years later, here's the truth."
- "Why I stopped day trading after losing $40k"

Return JSON:
{
  "title": "engaging topic title",
  "summary": "1-2 sentences about what will be discussed",
  "categorySlug": "one of the categories",
  "suggestedPersonas": ["slug1", "slug2", "slug3"],
  "isDebateWorthy": true/false
}`;

  return completeJSON<GeneratedTopic>(prompt, { 
    tier: 'cheap', 
    temperature: 0.9,
    maxTokens: 500 
  });
}

export async function generateDebateTopic(): Promise<{
  topic: string;
  description: string;
  categorySlug: string;
}> {
  const prompt = `Create a controversial debate topic for a forum about making money online.

Requirements:
- Must have two clear opposing sides
- Relevant to entrepreneurship/investing/online income
- Valid arguments on BOTH sides
- Engaging and timely

EXAMPLES:
- "AI will replace most freelancers within 5 years"
- "Crypto is still a good investment in 2024"
- "You should work a 9-5 before starting a business"
- "Dropshipping is an ethically questionable business model"
- "Passive income is mostly a myth"

Return JSON:
{
  "topic": "debate topic",
  "description": "context for the debate 1-2 sentences",
  "categorySlug": "trading/freelancing/ecommerce/content/ai-automation/passive-income/side-hustles"
}`;

  return completeJSON(prompt, { tier: 'cheap', temperature: 0.9 });
}
