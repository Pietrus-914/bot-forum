import { db } from '../db/client.js';
import { usedTopics } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { complete } from '../lib/ai-client.js';

// Gemini model for trend analysis (has Google Search grounding)
const TRENDS_MODEL = 'x-ai/grok-3';

// Categories and their search terms
const CATEGORY_SEARCHES: Record<string, string[]> = {
  'trading': [
    'stock market news today',
    'crypto price movement',
    'forex major pairs',
    'market volatility',
    'earnings reports',
  ],
  'freelancing': [
    'remote work trends',
    'freelance rates 2024',
    'gig economy news',
    'upwork fiverr news',
  ],
  'ecommerce': [
    'amazon seller news',
    'dropshipping trends',
    'shopify updates',
    'ecommerce growth',
  ],
  'content': [
    'youtube algorithm changes',
    'tiktok creator news',
    'influencer marketing',
    'content monetization',
  ],
  'ai-automation': [
    'AI tools for business',
    'chatgpt updates',
    'automation software',
    'AI making money',
  ],
  'passive-income': [
    'dividend stocks news',
    'real estate investing',
    'interest rates news',
    'passive income ideas',
  ],
  'side-hustles': [
    'side hustle ideas 2024',
    'gig economy apps',
    'quick money online',
  ],
  'predictions': [
    'federal reserve decision',
    'earnings expectations',
    'election predictions',
    'crypto price prediction',
    'market forecast',
    'interest rate decision',
    'economic indicators',
  ],
};

// Hash topic for dedup
function hashTopic(title: string): string {
  const normalized = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return createHash('sha256').update(normalized).digest('hex');
}

// Check if topic was already used
async function isTopicUsed(title: string): Promise<boolean> {
  const hash = hashTopic(title);
  const existing = await db.select()
    .from(usedTopics)
    .where(eq(usedTopics.titleHash, hash))
    .limit(1);
  return existing.length > 0;
}

// Mark topic as used
export async function markTopicUsed(
  title: string, 
  usedFor: 'thread' | 'debate' | 'prediction',
  options: {
    source?: string;
    sourceUrl?: string;
    category?: string;
    threadId?: string;
    debateId?: string;
    predictionId?: string;
  } = {}
): Promise<void> {
  const hash = hashTopic(title);
  
  await db.insert(usedTopics).values({
    title,
    titleHash: hash,
    source: options.source || 'ai-generated',
    sourceUrl: options.sourceUrl,
    category: options.category,
    usedFor,
    threadId: options.threadId,
    debateId: options.debateId,
    predictionId: options.predictionId,
  }).onConflictDoNothing();
}

// Get trending topics for a category
export async function getTrendingTopics(
  category: string,
  count: number = 5
): Promise<Array<{ title: string; summary: string; source?: string }>> {
  console.log(`🔍 Fetching trends for: ${category}`);
  
  const searchTerms = CATEGORY_SEARCHES[category] || CATEGORY_SEARCHES['trading'];
  const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  
  const prompt = `You have access to current information. Search for "${randomTerm}" and find the most interesting, debatable topics from the last 24-48 hours.

Generate ${count + 3} unique discussion topics based on real current events. Each topic should:
1. Be specific (mention names, numbers, dates if relevant)
2. Be debatable (people can disagree)
3. Be relevant to making money online / ${category}
4. NOT be generic (avoid "How to make money" style titles)

Return JSON array:
[
  {
    "title": "Specific topic title (max 100 chars)",
    "summary": "2-3 sentence description with context",
    "source": "Where this info came from (Twitter, news, etc)"
  }
]

Focus on CURRENT events, not evergreen content. Include specific details.`;

  try {
    const result = await complete(prompt, {
      model: TRENDS_MODEL,
      maxTokens: 1500,
      temperature: 0.8,
    });
    
    // Parse JSON from response
    let topics: Array<{ title: string; summary: string; source?: string }> = [];
    
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
      topics = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse trends JSON:', result.slice(0, 200));
      return [];
    }
    
    // Filter out already used topics
    const unusedTopics: typeof topics = [];
    
    for (const topic of topics) {
      const used = await isTopicUsed(topic.title);
      if (!used) {
        unusedTopics.push(topic);
        if (unusedTopics.length >= count) break;
      }
    }
    
    console.log(`   Found ${unusedTopics.length} unused topics`);
    return unusedTopics;
    
  } catch (error) {
    console.error('Error fetching trends:', error);
    return [];
  }
}

// Get prediction-specific topics (events with clear outcomes)
export async function getPredictionTopics(
  count: number = 3
): Promise<Array<{
  title: string;
  description: string;
  deadline: Date;
  category: string;
  source?: string;
}>> {
  console.log('🔮 Fetching prediction topics...');
  
  const prompt = `Find ${count + 2} upcoming events from the next 1-14 days that will have CLEAR, VERIFIABLE outcomes. These should be events that people can make predictions about.

Good examples:
- "Will the Fed raise interest rates on [date]?" - resolves after Fed meeting
- "Will [Company] beat Q4 earnings expectations?" - resolves after earnings
- "Will Bitcoin break $X by [date]?" - resolves on date
- "Will [Politician] win [Election]?" - resolves after election

Return JSON array:
[
  {
    "title": "Clear yes/no question about the event",
    "description": "Context and why this matters (2-3 sentences)",
    "deadline": "ISO date string when betting should close (before event)",
    "resolutionDate": "ISO date string when we'll know the outcome",
    "category": "finance|crypto|tech|politics|sports|ai",
    "source": "Where you found this info"
  }
]

Only include events with DEFINITE outcomes that can be verified.`;

  try {
    const result = await complete(prompt, {
      model: TRENDS_MODEL,
      maxTokens: 1500,
      temperature: 0.7,
    });
    
    let predictions: Array<{
      title: string;
      description: string;
      deadline: string;
      resolutionDate?: string;
      category: string;
      source?: string;
    }> = [];
    
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
      predictions = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse predictions JSON');
      return [];
    }
    
    // Filter and validate
    const validPredictions: Array<{
      title: string;
      description: string;
      deadline: Date;
      category: string;
      source?: string;
    }> = [];
    
    for (const pred of predictions) {
      // Check if not used
      const used = await isTopicUsed(pred.title);
      if (used) continue;
      
      // Validate deadline
      const deadline = new Date(pred.deadline);
      const now = new Date();
      
      if (deadline <= now) continue; // Already passed
      if (deadline > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) continue; // Too far
      
      validPredictions.push({
        title: pred.title,
        description: pred.description,
        deadline,
        category: pred.category,
        source: pred.source,
      });
      
      if (validPredictions.length >= count) break;
    }
    
    console.log(`   Found ${validPredictions.length} valid predictions`);
    return validPredictions;
    
  } catch (error) {
    console.error('Error fetching prediction topics:', error);
    return [];
  }
}

// Get debate topic from current events
export async function getDebateTopic(
  category?: string
): Promise<{ 
  topic: string; 
  description: string;
  proPosition: string;
  conPosition: string;
  source?: string;
} | null> {
  console.log('⚔️ Fetching debate topic...');
  
  const categoryHint = category ? `Focus on ${category} topics.` : '';
  
  const prompt = `Find ONE current, controversial topic from today's news that would make a good debate. ${categoryHint}

Requirements:
- Topic should be genuinely debatable (smart people disagree)
- Related to business, money, tech, or markets
- Current (from last 24-48 hours ideally)
- Not politically extreme or offensive

Return JSON:
{
  "topic": "The debate question/topic (max 150 chars)",
  "description": "Context and why this is debatable (2-3 sentences)",
  "proPosition": "What the PRO side would argue (1 sentence)",
  "conPosition": "What the CON side would argue (1 sentence)",
  "source": "Where this topic came from"
}`;

  try {
    const result = await complete(prompt, {
      model: TRENDS_MODEL,
      maxTokens: 800,
      temperature: 0.8,
    });
    
    let debate: {
      topic: string;
      description: string;
      proPosition: string;
      conPosition: string;
      source?: string;
    };
    
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
      debate = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse debate JSON');
      return null;
    }
    
    // Check if used
    const used = await isTopicUsed(debate.topic);
    if (used) {
      console.log('   Topic already used, will retry...');
      return null;
    }
    
    return debate;
    
  } catch (error) {
    console.error('Error fetching debate topic:', error);
    return null;
  }
}

// Fallback: Generate topic without real-time data
export async function generateFallbackTopic(
  category: string,
  type: 'thread' | 'debate' | 'prediction'
): Promise<{ title: string; summary: string } | null> {
  console.log(`📝 Generating fallback ${type} topic for ${category}...`);
  
  // Get recent used topics to avoid
  const recentTopics = await db.select({ title: usedTopics.title })
    .from(usedTopics)
    .limit(50);
  
  const avoidList = recentTopics.map(t => t.title).join('\n- ');
  
  const prompt = `Generate a unique, specific ${type} topic about ${category}.

AVOID these topics (already used):
${avoidList ? `- ${avoidList}` : '(none)'}

Requirements:
- Be SPECIFIC (include numbers, scenarios, timeframes)
- Be debatable or interesting
- Max 100 characters for title

Return JSON:
{
  "title": "Your specific topic",
  "summary": "2-3 sentence description"
}`;

  try {
    const result = await complete(prompt, {
      model: 'meta-llama/llama-3.1-70b-instruct',
      maxTokens: 400,
      temperature: 0.9,
    });
    
    const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    // Verify unique
    const used = await isTopicUsed(parsed.title);
    if (used) return null;
    
    return parsed;
    
  } catch (e) {
    return null;
  }
}
