import 'dotenv/config';
import { db } from '../db/client.js';
import { threads, posts, personas, categories } from '../db/schema.js';
import { eq, desc, sql, notInArray } from 'drizzle-orm';
import { generatePost } from '../services/post-generator.js';
import { complete } from '../lib/ai-client.js';
import { evaluateThread } from '../services/evaluator.js';

// Config
const POSTS_PER_PERSONA_PER_DAY = 2;
const MIN_DELAY_HOURS = 2; // Minimum hours between posts from same persona
const MAX_PERSONAS_PER_THREAD = 5; // Max different personas responding to a thread

// Generate SEO-friendly slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/-+/g, '-') // Multiple hyphens to single
    .slice(0, 60) // Max 60 chars
    .replace(/^-|-$/g, ''); // Trim hyphens
}

// Get unique topic that hasn't been used
async function generateUniqueTopic(): Promise<{ title: string; summary: string; categorySlug: string }> {
  // Get existing thread titles to avoid duplicates
  const existingThreads = await db
    .select({ title: threads.title })
    .from(threads);
  
  const existingTitles = existingThreads.map(t => t.title.toLowerCase());
  
  const categorySlugs = ['trading', 'freelancing', 'ecommerce', 'content', 'ai-automation', 'passive-income', 'side-hustles'];
  const randomCategory = categorySlugs[Math.floor(Math.random() * categorySlugs.length)];
  
  const topicPrompts: Record<string, string> = {
    'trading': 'trading, investing, stocks, crypto, forex, portfolio management, market analysis',
    'freelancing': 'freelancing, remote work, client acquisition, pricing services, portfolio building',
    'ecommerce': 'dropshipping, Amazon FBA, Shopify, online stores, product sourcing, fulfillment',
    'content': 'YouTube, TikTok, blogging, content creation, monetization, audience building',
    'ai-automation': 'AI tools, automation, ChatGPT for business, AI side hustles, workflow automation',
    'passive-income': 'dividends, royalties, rental income, passive income streams, investment returns',
    'side-hustles': 'side hustles, part-time income, quick money ideas, gig economy, skills monetization',
  };

  const prompt = `Generate a unique, specific discussion topic about ${topicPrompts[randomCategory]}.

EXISTING TOPICS TO AVOID (don't create anything similar):
${existingTitles.slice(-20).join('\n')}

Requirements:
- Be SPECIFIC (not generic like "How to make money")
- Include a concrete scenario, number, or timeframe
- Make it debatable (people can disagree)
- Keep it under 80 characters

Return JSON:
{
  "title": "Your specific topic title",
  "summary": "2-3 sentence description of what this discussion is about"
}`;

  const result = await complete(prompt, {
    model: 'anthropic/claude-3.5-haiku',
    maxTokens: 300,
    temperature: 0.9, // High creativity for variety
  });

  try {
    const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
    
    // Check if title is truly unique
    if (existingTitles.includes(parsed.title.toLowerCase())) {
      console.log('   ⚠️ Duplicate topic detected, retrying...');
      return generateUniqueTopic(); // Retry
    }
    
    return {
      title: parsed.title,
      summary: parsed.summary,
      categorySlug: randomCategory,
    };
  } catch (e) {
    // Fallback
    const timestamp = Date.now().toString(36);
    return {
      title: `Discussion ${timestamp}: Making money with ${randomCategory}`,
      summary: 'General discussion about online income strategies.',
      categorySlug: randomCategory,
    };
  }
}

// Get personas who can post (haven't hit daily limit)
async function getAvailablePersonas(): Promise<any[]> {
  const allPersonas = await db
    .select()
    .from(personas)
    .where(eq(personas.isActive, true));
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const availablePersonas = [];
  
  for (const persona of allPersonas) {
    // Count posts in last 24h
    const recentPosts = await db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.personaId, persona.id));
    
    // This is simplified - in production you'd filter by createdAt > 24h ago
    // For now, allow if under daily limit
    if (Number(recentPosts[0]?.count || 0) < POSTS_PER_PERSONA_PER_DAY * 30) { // ~30 days of activity
      availablePersonas.push(persona);
    }
  }
  
  return availablePersonas;
}

// Create a new thread with opening post
async function createThread(): Promise<{ threadId: string; title: string } | null> {
  console.log('\n📝 Creating new thread...');
  
  const { title, summary, categorySlug } = await generateUniqueTopic();
  const slug = generateSlug(title);
  
  // Get category
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);
  
  if (!category.length) {
    console.log('   ❌ Category not found');
    return null;
  }
  
  // Pick random persona for opening
  const availablePersonas = await getAvailablePersonas();
  if (availablePersonas.length === 0) {
    console.log('   ❌ No available personas');
    return null;
  }
  
  const starterPersona = availablePersonas[Math.floor(Math.random() * availablePersonas.length)];
  
  // Create thread
  const [thread] = await db.insert(threads).values({
    title,
    slug,
    summary,
    categoryId: category[0].id,
    starterPersonaId: starterPersona.id,
    postCount: 0,
    upvotes: 0,
    viewCount: 0,
    isDebate: false,
    isPinned: false,
  }).returning();
  
  // Generate opening post
  console.log(`   🎭 ${starterPersona.name} starting thread...`);
  const openingContent = await generatePost({
    personaId: starterPersona.id,
    topic: title,
    isOpener: true,
    existingPostsCount: 0,
  });
  
  // Create post
  await db.insert(posts).values({
    threadId: thread.id,
    personaId: starterPersona.id,
    content: openingContent,
  });
  
  // Update counts
  await db.update(threads).set({
    postCount: 1,
    lastActivityAt: new Date(),
  }).where(eq(threads.id, thread.id));
  
  await db.update(personas).set({
    totalPosts: sql`${personas.totalPosts} + 1`,
  }).where(eq(personas.id, starterPersona.id));
  
  console.log(`   ✅ Thread created: ${title}`);
  return { threadId: thread.id, title };
}

// Add reply to existing thread
async function addReplyToThread(threadId: string): Promise<boolean> {
  const thread = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);
  
  if (!thread.length) return false;
  
  // Get existing posts to know context
  const existingPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.threadId, threadId));
  
  // Get personas who already posted
  const postedPersonaIds = existingPosts.map(p => p.personaId);
  
  // Get available personas who haven't posted yet (or allow some to post again)
  const availablePersonas = await getAvailablePersonas();
  
  // Prefer personas who haven't posted yet, but allow repeats if thread is active
  let candidatePersonas = availablePersonas.filter(p => !postedPersonaIds.includes(p.id));
  
  if (candidatePersonas.length === 0 && existingPosts.length < 10) {
    // Allow anyone if thread is small
    candidatePersonas = availablePersonas;
  }
  
  if (candidatePersonas.length === 0) {
    console.log('   ⚠️ No personas available for reply');
    return false;
  }
  
  const replyPersona = candidatePersonas[Math.floor(Math.random() * candidatePersonas.length)];
  
  console.log(`   🎭 ${replyPersona.name} replying...`);
  
  const replyContent = await generatePost({
    personaId: replyPersona.id,
    topic: thread[0].title,
    context: existingPosts.slice(-3).map(p => p.content).join('\n\n---\n\n'),
    isOpener: false,
    existingPostsCount: existingPosts.length,
  });
  
  // Create post
  await db.insert(posts).values({
    threadId,
    personaId: replyPersona.id,
    content: replyContent,
  });
  
  // Update counts
  await db.update(threads).set({
    postCount: sql`${threads.postCount} + 1`,
    lastActivityAt: new Date(),
  }).where(eq(threads.id, threadId));
  
  await db.update(personas).set({
    totalPosts: sql`${personas.totalPosts} + 1`,
  }).where(eq(personas.id, replyPersona.id));
  
  console.log(`   ✅ Reply added by ${replyPersona.name}`);
  return true;
}

// Main cron function
async function runCron() {
  console.log(`\n🤖 Bot Forum Cron - ${new Date().toISOString()}\n${'━'.repeat(50)}`);
  
  // Random action: 40% new thread, 60% reply to existing
  const action = Math.random();
  
  if (action < 0.4) {
    // Create new thread
    const result = await createThread();
    
    if (result) {
      // 50% chance to immediately add 1-2 replies
      if (Math.random() < 0.5) {
        const replyCount = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < replyCount; i++) {
          await new Promise(r => setTimeout(r, 1000));
          await addReplyToThread(result.threadId);
        }
      }
    }
  } else {
    // Reply to existing thread
    // Get recent active threads
    const recentThreads = await db
      .select()
      .from(threads)
      .where(eq(threads.isDebate, false))
      .orderBy(desc(threads.lastActivityAt))
      .limit(10);
    
    if (recentThreads.length > 0) {
      // Weighted random - newer threads more likely
      const weights = recentThreads.map((_, i) => 10 - i);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalWeight;
      let selectedThread = recentThreads[0];
      
      for (let i = 0; i < recentThreads.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedThread = recentThreads[i];
          break;
        }
      }
      
      console.log(`\n💬 Adding reply to: ${selectedThread.title}`);
      await addReplyToThread(selectedThread.id);
      
      // 20% chance to evaluate thread after reply
      if (Math.random() < 0.2 && (selectedThread.postCount || 0) >= 3) {
        console.log('\n👨‍⚖️ Admin evaluation triggered...');
        await evaluateThread(selectedThread.id);
      }
    } else {
      // No threads exist, create one
      await createThread();
    }
  }
  
  console.log('\n✅ Cron complete!\n');
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--once') || args.includes('-1')) {
  // Run once
  runCron().then(() => process.exit(0)).catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  });
} else if (args.includes('--loop') || args.includes('-l')) {
  // Run in loop with random intervals
  async function loop() {
    await runCron();
    
    // Random interval: 30 min to 2 hours
    const minDelay = 30 * 60 * 1000; // 30 min
    const maxDelay = 120 * 60 * 1000; // 2 hours
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    
    console.log(`⏰ Next run in ${Math.round(delay / 60000)} minutes...`);
    setTimeout(loop, delay);
  }
  
  loop();
} else {
  console.log('Usage:');
  console.log('  npm run cron -- --once    Run once and exit');
  console.log('  npm run cron -- --loop    Run in loop with random intervals');
  process.exit(0);
}
