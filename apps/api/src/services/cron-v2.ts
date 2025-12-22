import 'dotenv/config';
import { db } from '../db/client.js';
import { 
  teams, personas, threads, posts, categories,
  debates, debateRounds, predictions, predictionBets,
  pendingMentions, personaPredictionStats
} from '../db/schema.js';
import { eq, desc, asc, sql, and, lt, gt, isNull, ne } from 'drizzle-orm';
import { complete } from '../lib/ai-client.js';
import { generatePost } from './post-generator.js';
import { getTrendingTopics, getDebateTopic, getPredictionTopics, markTopicUsed, generateFallbackTopic } from './trends.js';

// ==========================================
// CONFIGURATION
// ==========================================

// Hourly weights (0.0 - 1.0) - probability of posting
const HOUR_WEIGHTS: Record<number, number> = {
  0: 0.15, 1: 0.10, 2: 0.08, 3: 0.08, 4: 0.10, 5: 0.15,  // Night (low)
  6: 0.35, 7: 0.45, 8: 0.55,                              // Morning EU
  9: 0.70, 10: 0.75, 11: 0.80, 12: 0.85, 13: 0.80,       // Peak EU+US
  14: 0.75, 15: 0.65, 16: 0.55, 17: 0.50,                // Afternoon
  18: 0.60, 19: 0.70, 20: 0.75, 21: 0.70,                // Evening US
  22: 0.45, 23: 0.30,                                     // Late night
};

// Category weights (must sum to 1.0)
const CATEGORY_WEIGHTS: Record<string, number> = {
  'predictions': 0.30,      // Prediction Market - highest
  'trading': 0.15,
  'ai-automation': 0.12,
  'ecommerce': 0.10,
  'content': 0.10,
  'freelancing': 0.08,
  'side-hustles': 0.08,
  'passive-income': 0.07,
};

// Action weights when we decide to do something
const ACTION_WEIGHTS = {
  reply: 0.55,           // Reply to existing thread
  newThread: 0.25,       // Create new thread
  reviveThread: 0.12,    // Add to old thread
  newDebate: 0.05,       // Start debate (max 2/day)
  newPrediction: 0.03,   // Create prediction (max 2/day)
};

// Daily limits
const DAILY_LIMITS = {
  maxPosts: 25,
  maxThreads: 4,
  maxDebates: 2,
  maxPredictions: 2,
  minPosts: 12,
};

// ==========================================
// HELPERS
// ==========================================

function shouldAct(hour: number): boolean {
  const weight = HOUR_WEIGHTS[hour] || 0.5;
  return Math.random() < weight;
}

function pickCategory(): string {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    cumulative += weight;
    if (rand < cumulative) return cat;
  }
  
  return 'predictions'; // Default
}

function pickAction(): keyof typeof ACTION_WEIGHTS {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [action, weight] of Object.entries(ACTION_WEIGHTS)) {
    cumulative += weight;
    if (rand < cumulative) return action as keyof typeof ACTION_WEIGHTS;
  }
  
  return 'reply';
}

function slugify(text: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  return text
    .toLowerCase()
    .replace(/['''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) + '-' + randomSuffix;
}

// ==========================================
// PERSONA SELECTION
// ==========================================

// Get specialist persona for a category
async function getSpecialist(categorySlug: string, excludeIds: string[] = []): Promise<typeof personas.$inferSelect | null> {
  const results = await db.select()
    .from(personas)
    .where(and(
      eq(personas.primarySpecialization, categorySlug),
      eq(personas.isActive, true),
      excludeIds.length > 0 ? sql`${personas.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})` : sql`1=1`
    ))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  
  return results[0] || null;
}

// Get random persona from team
async function getTeamMember(teamId: string, excludeIds: string[] = []): Promise<typeof personas.$inferSelect | null> {
  const results = await db.select()
    .from(personas)
    .where(and(
      eq(personas.teamId, teamId),
      eq(personas.isActive, true),
      excludeIds.length > 0 ? sql`${personas.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})` : sql`1=1`
    ))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  
  return results[0] || null;
}

// Get any active persona
async function getRandomPersona(excludeIds: string[] = []): Promise<typeof personas.$inferSelect | null> {
  const results = await db.select()
    .from(personas)
    .where(and(
      eq(personas.isActive, true),
      excludeIds.length > 0 ? sql`${personas.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})` : sql`1=1`
    ))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  
  return results[0] || null;
}

// ==========================================
// THREAD ACTIONS
// ==========================================

async function createNewThread(categorySlug: string): Promise<string | null> {
  console.log(`\n📝 Creating new thread in ${categorySlug}...`);
  
  // Get category
  const [category] = await db.select().from(categories).where(eq(categories.slug, categorySlug)).limit(1);
  if (!category) {
    console.log('   ❌ Category not found');
    return null;
  }
  
  // Get specialist
  const specialist = await getSpecialist(categorySlug);
  if (!specialist) {
    console.log('   ❌ No specialist found');
    return null;
  }
  
  // Get topic from trends
  let topic: { title: string; summary: string } | null = null;
  
  const trends = await getTrendingTopics(categorySlug, 1);
  if (trends.length > 0) {
    topic = trends[0];
  } else {
    // Fallback
    topic = await generateFallbackTopic(categorySlug, 'thread');
  }
  
  if (!topic) {
    console.log('   ❌ Could not generate topic');
    return null;
  }
  
  // Generate opening post
  const prompt = `You're starting a discussion thread about: "${topic.title}"

Context: ${topic.summary}

Write an engaging opening post that:
1. Introduces the topic and why it matters NOW
2. Shares your perspective based on your experience
3. Asks 1-2 questions to spark discussion
4. Stays under 250 words

Remember your personality and background. Be specific with examples/numbers.`;

  const content = await complete(prompt, {
    model: specialist.modelName || 'meta-llama/llama-3.1-70b-instruct',
    systemPrompt: specialist.personalityPrompt,
    temperature: (specialist.temperature || 70) / 100,
    maxTokens: specialist.maxTokens || 600,
  });
  
  // Create thread
  const threadSlug = slugify(topic.title);
  
  const [thread] = await db.insert(threads).values({
    title: topic.title,
    slug: threadSlug,
    summary: topic.summary,
    categoryId: category.id,
    starterPersonaId: specialist.id,
    postCount: 1,
  }).returning();
  
  // Create opening post
  await db.insert(posts).values({
    threadId: thread.id,
    personaId: specialist.id,
    content,
    generationMeta: { model: specialist.modelName, topic: topic.title },
  });
  
  // Update persona stats
  await db.update(personas)
    .set({ totalPosts: sql`${personas.totalPosts} + 1` })
    .where(eq(personas.id, specialist.id));
  
  // Mark topic used
  await markTopicUsed(topic.title, 'thread', {
    category: categorySlug,
    threadId: thread.id,
  });
  
  console.log(`   ✅ Created: "${topic.title.slice(0, 50)}..." by ${specialist.name}`);
  return thread.id;
}

async function replyToThread(threadId?: string): Promise<boolean> {
  // Get thread (random active or specific)
  let thread: typeof threads.$inferSelect | undefined;
  
  if (threadId) {
    [thread] = await db.select().from(threads).where(eq(threads.id, threadId)).limit(1);
  } else {
    // Pick active thread from last 7 days
    const recentThreads = await db.select()
      .from(threads)
      .where(and(
        gt(threads.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        lt(threads.postCount, 15), // Not too many posts
        eq(threads.isDebate, false),
      ))
      .orderBy(sql`RANDOM()`)
      .limit(1);
    
    thread = recentThreads[0];
  }
  
  if (!thread) {
    console.log('   No suitable thread found');
    return false;
  }
  
  // Get thread's category
  const [category] = await db.select().from(categories).where(eq(categories.id, thread.categoryId)).limit(1);
  
  // Get existing posters in this thread
  const existingPosts = await db.select({ personaId: posts.personaId })
    .from(posts)
    .where(eq(posts.threadId, thread.id));
  
  const existingIds = existingPosts.map(p => p.personaId);
  
  // Decide who responds (70% specialist, 20% call specialist, 10% random)
  const roll = Math.random();
  let responder: typeof personas.$inferSelect | null = null;
  let mentionedPersona: typeof personas.$inferSelect | null = null;
  let shouldCallSpecialist = false;
  
  if (roll < 0.70) {
    // Specialist responds
    responder = await getSpecialist(category?.slug || 'trading', existingIds);
  } else if (roll < 0.90) {
    // Someone calls the specialist
    responder = await getRandomPersona(existingIds);
    if (responder) {
      mentionedPersona = await getSpecialist(category?.slug || 'trading');
      shouldCallSpecialist = mentionedPersona !== null && mentionedPersona.id !== responder.id;
    }
  } else {
    // Random person
    responder = await getRandomPersona(existingIds);
  }
  
  if (!responder) {
    responder = await getRandomPersona();
  }
  
  if (!responder) {
    console.log('   No responder found');
    return false;
  }
  
  // Get thread context
  const threadPosts = await db.select({
    content: posts.content,
    personaName: personas.name,
  })
    .from(posts)
    .innerJoin(personas, eq(posts.personaId, personas.id))
    .where(eq(posts.threadId, thread.id))
    .orderBy(asc(posts.createdAt))
    .limit(5);
  
  const context = threadPosts.map(p => `${p.personaName}: ${p.content.slice(0, 300)}...`).join('\n\n');
  
  // Generate response
  let prompt: string;
  
  if (shouldCallSpecialist && mentionedPersona) {
    prompt = `Thread: "${thread.title}"

Recent discussion:
${context}

Write a response that:
1. Adds your perspective briefly
2. Tags @${mentionedPersona.name} and asks for their expert opinion
3. Keep it under 150 words

You're calling in the specialist because this relates to their expertise.`;
  } else {
    prompt = `Thread: "${thread.title}"

Recent discussion:
${context}

Write a response that:
1. Engages with what others said (agree, disagree, or build on)
2. Adds your unique perspective from your experience
3. Can be supportive, challenging, or questioning
4. Keep it under 200 words

Be genuine - you can disagree or push back if you have different experience.`;
  }
  
  const content = await complete(prompt, {
    model: responder.modelName || 'meta-llama/llama-3.1-70b-instruct',
    systemPrompt: responder.personalityPrompt,
    temperature: (responder.temperature || 70) / 100,
    maxTokens: responder.maxTokens || 600,
  });
  
  // Create post
  const [post] = await db.insert(posts).values({
    threadId: thread.id,
    personaId: responder.id,
    content,
    mentionedPersonaId: shouldCallSpecialist ? mentionedPersona?.id : null,
    generationMeta: { model: responder.modelName },
  }).returning();
  
  // Update thread
  await db.update(threads)
    .set({ 
      postCount: sql`${threads.postCount} + 1`,
      lastActivityAt: new Date(),
    })
    .where(eq(threads.id, thread.id));
  
  // Update persona stats
  await db.update(personas)
    .set({ totalPosts: sql`${personas.totalPosts} + 1` })
    .where(eq(personas.id, responder.id));
  
  // If mentioned someone, create pending mention
  if (shouldCallSpecialist && mentionedPersona) {
    await db.insert(pendingMentions).values({
      threadId: thread.id,
      postId: post.id,
      mentionedPersonaId: mentionedPersona.id,
      mentionedByPersonaId: responder.id,
      context: thread.title,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
    });
    console.log(`   ✅ ${responder.name} called @${mentionedPersona.name} in "${thread.title.slice(0, 30)}..."`);
  } else {
    console.log(`   ✅ ${responder.name} replied to "${thread.title.slice(0, 30)}..."`);
  }
  
  return true;
}

// Respond to pending @mentions
async function respondToMentions(): Promise<number> {
  const pending = await db.select()
    .from(pendingMentions)
    .where(and(
      eq(pendingMentions.status, 'pending'),
      gt(pendingMentions.expiresAt, new Date()),
    ))
    .limit(3);
  
  let responded = 0;
  
  for (const mention of pending) {
    const [persona] = await db.select().from(personas).where(eq(personas.id, mention.mentionedPersonaId)).limit(1);
    if (!persona) continue;
    
    const [thread] = await db.select().from(threads).where(eq(threads.id, mention.threadId)).limit(1);
    if (!thread) continue;
    
    // Get recent posts
    const recentPosts = await db.select({
      content: posts.content,
      personaName: personas.name,
    })
      .from(posts)
      .innerJoin(personas, eq(posts.personaId, personas.id))
      .where(eq(posts.threadId, thread.id))
      .orderBy(desc(posts.createdAt))
      .limit(3);
    
    const context = recentPosts.reverse().map(p => `${p.personaName}: ${p.content.slice(0, 200)}...`).join('\n\n');
    
    const prompt = `You were tagged in this thread: "${thread.title}"

Recent discussion:
${context}

Someone asked for your expert opinion. Respond with:
1. Your specialist knowledge on this topic
2. Specific data, examples, or experiences
3. Keep it under 250 words

This is your area of expertise - show it!`;

    const content = await complete(prompt, {
      model: persona.modelName || 'meta-llama/llama-3.1-70b-instruct',
      systemPrompt: persona.personalityPrompt,
      temperature: (persona.temperature || 70) / 100,
      maxTokens: persona.maxTokens || 600,
    });
    
    // Create response post
    const [newPost] = await db.insert(posts).values({
      threadId: thread.id,
      personaId: persona.id,
      content,
      generationMeta: { model: persona.modelName, respondingToMention: true },
    }).returning();
    
    // Update mention
    await db.update(pendingMentions)
      .set({ status: 'responded', respondedPostId: newPost.id })
      .where(eq(pendingMentions.id, mention.id));
    
    // Update stats
    await db.update(threads)
      .set({ postCount: sql`${threads.postCount} + 1`, lastActivityAt: new Date() })
      .where(eq(threads.id, thread.id));
    
    await db.update(personas)
      .set({ totalPosts: sql`${personas.totalPosts} + 1` })
      .where(eq(personas.id, persona.id));
    
    console.log(`   ✅ ${persona.name} responded to mention in "${thread.title.slice(0, 30)}..."`);
    responded++;
  }
  
  return responded;
}

// ==========================================
// DEBATE ACTIONS
// ==========================================

async function createDebate(): Promise<string | null> {
  console.log('\n⚔️ Creating new debate...');
  
  // Get debate topic
  const debateTopic = await getDebateTopic();
  if (!debateTopic) {
    console.log('   ❌ Could not get debate topic');
    return null;
  }
  
  // Get two personas from DIFFERENT teams
  const allTeams = await db.select().from(teams).where(eq(teams.isActive, true));
  if (allTeams.length < 2) {
    console.log('   ❌ Not enough teams');
    return null;
  }
  
  // Shuffle and pick two
  const shuffled = allTeams.sort(() => Math.random() - 0.5);
  const team1 = shuffled[0];
  const team2 = shuffled[1];
  
  const persona1 = await getTeamMember(team1.id);
  const persona2 = await getTeamMember(team2.id);
  
  if (!persona1 || !persona2) {
    console.log('   ❌ Could not get personas');
    return null;
  }
  
  // Get category
  const [category] = await db.select().from(categories).orderBy(sql`RANDOM()`).limit(1);
  
  // Create thread for debate
  const threadSlug = slugify(`debate-${debateTopic.topic}`);
  
  const [thread] = await db.insert(threads).values({
    title: `⚔️ DEBATE: ${debateTopic.topic}`,
    slug: threadSlug,
    summary: debateTopic.description,
    categoryId: category.id,
    starterPersonaId: persona1.id,
    isDebate: true,
    postCount: 0,
  }).returning();
  
  // Create debate record
  const debateSlug = slugify(debateTopic.topic);
  
  const [debate] = await db.insert(debates).values({
    topic: debateTopic.topic,
    slug: debateSlug,
    description: debateTopic.description,
    threadId: thread.id,
    categoryId: category.id,
    team1Id: team1.id,
    persona1Id: persona1.id,
    persona1Stance: 'pro',
    team2Id: team2.id,
    persona2Id: persona2.id,
    persona2Stance: 'con',
    totalRounds: 6, // 6 rounds = 12 posts
    currentRound: 0,
    status: 'active',
  }).returning();
  
  // Link debate to thread
  await db.update(threads).set({ debateId: debate.id }).where(eq(threads.id, thread.id));
  
  // Mark topic used
  await markTopicUsed(debateTopic.topic, 'debate', {
    debateId: debate.id,
  });
  
  console.log(`   ✅ Debate created: ${team1.name} vs ${team2.name}`);
  console.log(`   📋 Topic: "${debateTopic.topic.slice(0, 50)}..."`);
  
  // Generate first round immediately
  await progressDebate(debate.id);
  
  return debate.id;
}

async function progressDebate(debateId: string): Promise<boolean> {
  const [debate] = await db.select().from(debates).where(eq(debates.id, debateId)).limit(1);
  if (!debate || debate.status !== 'active') return false;
  
  const currentRound = debate.currentRound || 0;
  const totalRounds = debate.totalRounds || 6;
  
  if (currentRound >= totalRounds) {
    // Finish debate
    await finishDebate(debateId);
    return true;
  }
  
  // Get personas
  const [persona1] = await db.select().from(personas).where(eq(personas.id, debate.persona1Id)).limit(1);
  const [persona2] = await db.select().from(personas).where(eq(personas.id, debate.persona2Id)).limit(1);
  
  if (!persona1 || !persona2) return false;
  
  // Get previous posts
  const previousPosts = await db.select({
    content: posts.content,
    personaName: personas.name,
  })
    .from(posts)
    .innerJoin(personas, eq(posts.personaId, personas.id))
    .where(eq(posts.threadId, debate.threadId!))
    .orderBy(asc(posts.createdAt))
    .limit(10);
  
  const context = previousPosts.map(p => `${p.personaName}: ${p.content.slice(0, 300)}`).join('\n\n');
  
  const newRound = currentRound + 1;
  
  // Create round record
  const [round] = await db.insert(debateRounds).values({
    debateId: debate.id,
    roundNumber: newRound,
  }).returning();
  
  // Both personas post
  for (const [persona, stance] of [[persona1, 'PRO'], [persona2, 'CON']] as const) {
    const prompt = `DEBATE: "${debate.topic}"

You are arguing ${stance}.

${context ? `Previous discussion:\n${context}` : 'This is the opening. Make your strongest opening argument.'}

Round ${newRound}/${totalRounds}. ${newRound === totalRounds ? 'This is your FINAL argument - make it count!' : ''}

Write your ${stance} argument:
1. ${newRound === 1 ? 'State your position clearly' : 'Respond to opponent\'s points'}
2. Provide evidence or examples
3. ${stance === 'PRO' ? 'Explain why this is beneficial' : 'Explain the risks and downsides'}
4. Keep under 200 words

Be persuasive but stay civil. You can be passionate.`;

    const content = await complete(prompt, {
      model: persona.modelName || 'meta-llama/llama-3.1-70b-instruct',
      systemPrompt: persona.personalityPrompt,
      temperature: (persona.temperature || 70) / 100,
      maxTokens: 500,
    });
    
    const [post] = await db.insert(posts).values({
      threadId: debate.threadId!,
      personaId: persona.id,
      content,
      generationMeta: { model: persona.modelName, debateRound: newRound, stance },
    }).returning();
    
    // Update round with post ID
    if (persona.id === persona1.id) {
      await db.update(debateRounds).set({ persona1PostId: post.id }).where(eq(debateRounds.id, round.id));
    } else {
      await db.update(debateRounds).set({ persona2PostId: post.id }).where(eq(debateRounds.id, round.id));
    }
    
    // Update persona stats
    await db.update(personas)
      .set({ totalPosts: sql`${personas.totalPosts} + 1` })
      .where(eq(personas.id, persona.id));
  }
  
  // Update debate and thread
  await db.update(debates)
    .set({ currentRound: newRound })
    .where(eq(debates.id, debate.id));
  
  await db.update(threads)
    .set({ 
      postCount: sql`${threads.postCount} + 2`,
      lastActivityAt: new Date(),
    })
    .where(eq(threads.id, debate.threadId!));
  
  console.log(`   ⚔️ Debate round ${newRound}/${totalRounds} completed`);
  
  return true;
}

async function finishDebate(debateId: string): Promise<void> {
  console.log('\n👨‍⚖️ Finishing debate...');
  
  const [debate] = await db.select().from(debates).where(eq(debates.id, debateId)).limit(1);
  if (!debate) return;
  
  // Get all debate posts
  const debatePosts = await db.select({
    content: posts.content,
    personaId: posts.personaId,
    personaName: personas.name,
    teamId: personas.teamId,
  })
    .from(posts)
    .innerJoin(personas, eq(posts.personaId, personas.id))
    .where(eq(posts.threadId, debate.threadId!))
    .orderBy(asc(posts.createdAt));
  
  // Get team names
  const [team1] = await db.select().from(teams).where(eq(teams.id, debate.team1Id!)).limit(1);
  const [team2] = await db.select().from(teams).where(eq(teams.id, debate.team2Id!)).limit(1);
  const [persona1] = await db.select().from(personas).where(eq(personas.id, debate.persona1Id)).limit(1);
  const [persona2] = await db.select().from(personas).where(eq(personas.id, debate.persona2Id)).limit(1);
  
  // Admin evaluates using Claude
  const debateContent = debatePosts.map(p => `${p.personaName}: ${p.content}`).join('\n\n---\n\n');
  
  const adminPrompt = `You are an IMPARTIAL AI ADMIN judge evaluating this debate. You have no team affiliation.

TOPIC: "${debate.topic}"

${persona1?.name} (${team1?.name}) - PRO position
${persona2?.name} (${team2?.name}) - CON position

DEBATE TRANSCRIPT:
${debateContent}

Evaluate EACH participant on these 5 criteria (1-20 points each, max 100 total):

1. 🎭 CHARACTER AUTHENTICITY (1-20): How well does the AI embody their assigned personality? Natural voice, consistent character traits.
2. 🎯 TOPIC RELEVANCE (1-20): How well do they stay on topic? Are arguments directly related to the debate question?
3. 💬 ARGUMENTATION QUALITY (1-20): Logic, coherence, structure of arguments. Use of evidence and examples.
4. ⚔️ ENGAGEMENT (1-20): How well do they respond to opponent's points? Do they address counterarguments?
5. ✍️ COMMUNICATION STYLE (1-20): Natural forum writing style, readability, appropriate tone.

Determine the WINNER based on total score.

Return ONLY valid JSON (no markdown, no extra text):
{
  "persona1Scores": { "authenticity": X, "relevance": X, "argumentation": X, "engagement": X, "style": X },
  "persona2Scores": { "authenticity": X, "relevance": X, "argumentation": X, "engagement": X, "style": X },
  "persona1Total": X,
  "persona2Total": X,
  "winnerId": "${debate.persona1Id}" or "${debate.persona2Id}" or "draw",
  "summary": "2-3 sentences explaining who won and why. Be specific about strengths and weaknesses."
}`;

  const result = await complete(adminPrompt, {
    model: 'x-ai/grok-4',
    maxTokens: 1500,
    temperature: 0.3,
  });
  
  let evaluation: {
    persona1Scores: Record<string, number>;
    persona2Scores: Record<string, number>;
    persona1Total: number;
    persona2Total: number;
    winnerId: string;
    summary: string;
  };
  
  try {
    // Extract JSON from response - handle markdown code blocks and extra text
    let jsonStr = result;
    
    // Remove markdown code blocks
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/\n?```/g, '');
    
    // Find JSON object in response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', result.slice(0, 200));
      return;
    }
    
    // Sanitize control characters in string values (especially in summary)
    let sanitized = jsonMatch[0];
    sanitized = sanitized.replace(/"([^"]*?)"/g, (match, content) => {
      const cleaned = content
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/[\x00-\x1F\x7F]/g, '');
      return `"${cleaned}"`;
    });
    
    evaluation = JSON.parse(sanitized);
    console.log('   ✅ Admin evaluation parsed successfully');
  } catch (e) {
    console.error('Failed to parse admin evaluation:', e);
    console.error('Response was:', result.slice(0, 500));
    return;
  }
  
  // Post admin summary
  const summaryContent = `## 🏆 DEBATE CONCLUDED

**Topic:** ${debate.topic}

### 📊 Final Scores

| Criteria | ${persona1?.name} (PRO) | ${persona2?.name} (CON) |
|----------|------------------------|------------------------|
| 🎭 Character Authenticity | ${evaluation.persona1Scores.authenticity}/20 | ${evaluation.persona2Scores.authenticity}/20 |
| 🎯 Topic Relevance | ${evaluation.persona1Scores.relevance}/20 | ${evaluation.persona2Scores.relevance}/20 |
| 💬 Argumentation | ${evaluation.persona1Scores.argumentation}/20 | ${evaluation.persona2Scores.argumentation}/20 |
| ⚔️ Engagement | ${evaluation.persona1Scores.engagement}/20 | ${evaluation.persona2Scores.engagement}/20 |
| ✍️ Communication | ${evaluation.persona1Scores.style}/20 | ${evaluation.persona2Scores.style}/20 |
| **TOTAL** | **${evaluation.persona1Total}/100** | **${evaluation.persona2Total}/100** |

### 🏆 Winner: ${evaluation.winnerId === 'draw' ? 'DRAW' : evaluation.winnerId === debate.persona1Id ? `${persona1?.name} (${team1?.name})` : `${persona2?.name} (${team2?.name})`}

### 📝 Judge's Analysis

${evaluation.summary}`;

  const [summaryPost] = await db.insert(posts).values({
    threadId: debate.threadId!,
    personaId: debate.persona1Id, // Admin evaluator (marked via isAdminPost)
    content: summaryContent,
    isAdminPost: true,
    generationMeta: { adminEvaluation: true },
  }).returning();
  
  // Update debate
  const winnerId = evaluation.winnerId === 'draw' ? null : evaluation.winnerId;
  const winnerTeamId = winnerId === debate.persona1Id ? debate.team1Id : winnerId === debate.persona2Id ? debate.team2Id : null;
  
  await db.update(debates).set({
    status: 'completed',
    winnerId,
    winnerTeamId,
    adminSummary: evaluation.summary,
    adminSummaryPostId: summaryPost.id,
    persona1FinalScore: evaluation.persona1Total,
    persona2FinalScore: evaluation.persona2Total,
    persona1Scores: evaluation.persona1Scores,
    persona2Scores: evaluation.persona2Scores,
    completedAt: new Date(),
  }).where(eq(debates.id, debate.id));
  
  // Update persona stats
  if (winnerId) {
    const loserId = winnerId === debate.persona1Id ? debate.persona2Id : debate.persona1Id;
    
    await db.update(personas)
      .set({ 
        debatesWon: sql`${personas.debatesWon} + 1`,
        eloRating: sql`${personas.eloRating} + 25`,
      })
      .where(eq(personas.id, winnerId));
    
    await db.update(personas)
      .set({ 
        debatesLost: sql`${personas.debatesLost} + 1`,
        eloRating: sql`${personas.eloRating} - 15`,
      })
      .where(eq(personas.id, loserId));
    
    // Update team stats
    if (winnerTeamId) {
      const loserTeamId = winnerTeamId === debate.team1Id ? debate.team2Id : debate.team1Id;
      
      await db.update(teams)
        .set({ debatesWon: sql`${teams.debatesWon} + 1` })
        .where(eq(teams.id, winnerTeamId));
      
      if (loserTeamId) {
        await db.update(teams)
          .set({ debatesLost: sql`${teams.debatesLost} + 1` })
          .where(eq(teams.id, loserTeamId));
      }
    }
  }
  
  // Update thread
  await db.update(threads)
    .set({ postCount: sql`${threads.postCount} + 1`, lastActivityAt: new Date() })
    .where(eq(threads.id, debate.threadId!));
  
  console.log(`   ✅ Debate finished! Winner: ${winnerId ? (winnerId === debate.persona1Id ? persona1?.name : persona2?.name) : 'DRAW'}`);
}

// ==========================================
// PREDICTION ACTIONS
// ==========================================

async function createPrediction(): Promise<string | null> {
  console.log('\n🔮 Creating new prediction...');
  
  const predictionTopics = await getPredictionTopics(1);
  if (predictionTopics.length === 0) {
    console.log('   ❌ Could not get prediction topic');
    return null;
  }
  
  const topic = predictionTopics[0];
  
  // Get category
  const [category] = await db.select().from(categories).where(eq(categories.slug, 'predictions')).limit(1);
  if (!category) return null;
  
  // Get specialist
  const specialist = await getSpecialist('predictions');
  if (!specialist) return null;
  
  // Create thread
  const threadSlug = slugify(`prediction-${topic.title}`);
  
  const [thread] = await db.insert(threads).values({
    title: `🔮 ${topic.title}`,
    slug: threadSlug,
    summary: topic.description,
    categoryId: category.id,
    starterPersonaId: specialist.id,
    postCount: 1,
  }).returning();
  
  // Create prediction
  const predSlug = slugify(topic.title);
  
  const [prediction] = await db.insert(predictions).values({
    title: topic.title,
    slug: predSlug,
    description: topic.description,
    category: topic.category,
    deadline: topic.deadline,
    threadId: thread.id,
    status: 'open',
  }).returning();
  
  // Specialist makes opening + first bet
  const prompt = `You're opening a PREDICTION thread about: "${topic.title}"

Context: ${topic.description}
Deadline: ${topic.deadline.toLocaleDateString()}

Write a post that:
1. Explains the prediction and context
2. States YOUR prediction (YES or NO)
3. States your CONFIDENCE (as percentage, e.g., "I'm 72% confident")
4. Explains your reasoning with specific data/logic
5. Invites others to make their predictions

Keep under 300 words. Be specific about why you think this will/won't happen.`;

  const content = await complete(prompt, {
    model: specialist.modelName || 'meta-llama/llama-3.1-70b-instruct',
    systemPrompt: specialist.personalityPrompt,
    temperature: (specialist.temperature || 70) / 100,
    maxTokens: 600,
  });
  
  // Parse stance and confidence from content (basic extraction)
  const yesMatch = content.toLowerCase().includes('yes') || content.toLowerCase().includes('will happen');
  const confidenceMatch = content.match(/(\d{1,3})%/);
  const confidence = confidenceMatch ? Math.min(99, Math.max(1, parseInt(confidenceMatch[1]))) : 65;
  const stance = yesMatch ? 'yes' : 'no';
  
  // Create opening post
  const [post] = await db.insert(posts).values({
    threadId: thread.id,
    personaId: specialist.id,
    content,
    generationMeta: { model: specialist.modelName, predictionId: prediction.id },
  }).returning();
  
  // Create first bet
  await db.insert(predictionBets).values({
    predictionId: prediction.id,
    personaId: specialist.id,
    teamId: specialist.teamId,
    stance,
    confidence,
    reasoning: `Opening prediction based on initial analysis.`,
    postId: post.id,
  });
  
  // Update prediction stats
  await db.update(predictions).set({
    totalBets: 1,
    [stance === 'yes' ? 'yesCount' : 'noCount']: 1,
    avgConfidence: confidence,
  }).where(eq(predictions.id, prediction.id));
  
  // Update persona stats
  await db.update(personas)
    .set({ totalPosts: sql`${personas.totalPosts} + 1` })
    .where(eq(personas.id, specialist.id));
  
  await db.update(personaPredictionStats)
    .set({ 
      totalPredictions: sql`${personaPredictionStats.totalPredictions} + 1`,
      pendingPredictions: sql`${personaPredictionStats.pendingPredictions} + 1`,
    })
    .where(eq(personaPredictionStats.personaId, specialist.id));
  
  // Mark topic used
  await markTopicUsed(topic.title, 'prediction', {
    category: topic.category,
    predictionId: prediction.id,
  });
  
  console.log(`   ✅ Prediction created: "${topic.title.slice(0, 50)}..."`);
  console.log(`   📊 ${specialist.name} bets ${stance.toUpperCase()} (${confidence}%)`);
  
  return prediction.id;
}

// ==========================================
// MAIN CRON RUNNER
// ==========================================

export async function runCronCycle(): Promise<void> {
  const now = new Date();
  const hour = now.getUTCHours();
  
  console.log('\n' + '='.repeat(50));
  console.log(`🕐 Bot Forum Cron - ${now.toISOString()}`);
  console.log(`   Hour: ${hour} UTC | Weight: ${HOUR_WEIGHTS[hour]}`);
  console.log('='.repeat(50));
  
  // Check if we should act this hour
  if (!shouldAct(hour)) {
    console.log('   💤 Low activity hour - skipping');
    return;
  }
  
  // First: respond to any pending @mentions (priority)
  const mentionResponses = await respondToMentions();
  if (mentionResponses > 0) {
    console.log(`\n📢 Responded to ${mentionResponses} pending mentions`);
  }
  
  // Progress any active debates
  const activeDebates = await db.select()
    .from(debates)
    .where(eq(debates.status, 'active'))
    .limit(2);
  
  for (const debate of activeDebates) {
    if (Math.random() < 0.4) { // 40% chance per active debate
      await progressDebate(debate.id);
    }
  }
  
  // Check for debates that should be finished (reached max rounds)
  const finishableDebates = await db.select()
    .from(debates)
    .where(and(
      eq(debates.status, 'active'),
      sql`${debates.currentRound} >= ${debates.totalRounds}`
    ))
    .limit(1);
  
  for (const debate of finishableDebates) {
    await finishDebate(debate.id);
  }
  
  // Decide main action
  const action = pickAction();
  const category = pickCategory();
  
  console.log(`\n🎲 Action: ${action} | Category: ${category}`);
  
  switch (action) {
    case 'newThread':
      await createNewThread(category);
      break;
    
    case 'reply':
      await replyToThread();
      break;
    
    case 'reviveThread':
      // Reply to older thread
      const oldThreads = await db.select()
        .from(threads)
        .where(and(
          lt(threads.createdAt, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
          gt(threads.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
          lt(threads.postCount, 12),
          eq(threads.isDebate, false),
        ))
        .orderBy(sql`RANDOM()`)
        .limit(1);
      
      if (oldThreads[0]) {
        console.log(`   🔄 Reviving old thread...`);
        await replyToThread(oldThreads[0].id);
      }
      break;
    
    case 'newDebate':
      // Check daily limit
      const todayDebates = await db.select({ count: sql<number>`count(*)` })
        .from(debates)
        .where(gt(debates.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
      
      if ((todayDebates[0]?.count || 0) < DAILY_LIMITS.maxDebates) {
        await createDebate();
      } else {
        console.log('   ⚠️ Daily debate limit reached');
        await replyToThread();
      }
      break;
    
    case 'newPrediction':
      // Check daily limit
      const todayPreds = await db.select({ count: sql<number>`count(*)` })
        .from(predictions)
        .where(gt(predictions.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
      
      if ((todayPreds[0]?.count || 0) < DAILY_LIMITS.maxPredictions) {
        await createPrediction();
      } else {
        console.log('   ⚠️ Daily prediction limit reached');
        await replyToThread();
      }
      break;
  }
  
  // Maybe add burst activity (30% chance)
  if (Math.random() < 0.30) {
    console.log('\n⚡ Burst activity...');
    await replyToThread();
  }
  
  console.log('\n✅ Cron cycle complete\n');
}

// Run if called directly
if (process.argv[1]?.includes('cron-v2')) {
  runCronCycle()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}

// ==========================================

// ==========================================
// EXPORTED FUNCTIONS FOR PANEL
// ==========================================

export async function createDebateFromTopic(topic: string): Promise<string | null> {
  console.log(`\n⚔️ Creating debate from topic: ${topic}`);
  
  const allPersonas = await db.select().from(personas);
  const teamGroups: Record<string, typeof allPersonas> = {};
  
  for (const p of allPersonas) {
    if (p.teamId) {
      if (!teamGroups[p.teamId]) teamGroups[p.teamId] = [];
      teamGroups[p.teamId].push(p);
    }
  }
  
  const teamIds = Object.keys(teamGroups);
  if (teamIds.length < 2) return null;
  
  const shuffled = teamIds.sort(() => Math.random() - 0.5);
  const team1Id = shuffled[0];
  const team2Id = shuffled[1];
  
  const persona1 = teamGroups[team1Id][Math.floor(Math.random() * teamGroups[team1Id].length)];
  const persona2 = teamGroups[team2Id][Math.floor(Math.random() * teamGroups[team2Id].length)];
  
  const [category] = await db.select().from(categories).where(eq(categories.slug, 'trading')).limit(1);
  if (!category) return null;
  
  const threadSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '-' + Math.random().toString(36).slice(2, 10);
  const debateSlug = 'debate-' + threadSlug;
  
  const [thread] = await db.insert(threads).values({
    title: `🥊 Debate: ${topic}`,
    slug: threadSlug,
    summary: topic,
    categoryId: category.id,
    starterPersonaId: persona1.id,
    isDebate: true,
    postCount: 0,
  }).returning();
  
  const [debate] = await db.insert(debates).values({
    topic,
    slug: debateSlug,
    description: topic,
    persona1Id: persona1.id,
    persona2Id: persona2.id,
    team1Id: team1Id,
    team2Id: team2Id,
    threadId: thread.id,
    status: 'active',
    currentRound: 1,
    totalRounds: 3,
  }).returning();
  
  await db.update(threads).set({ debateId: debate.id }).where(eq(threads.id, thread.id));
  
  await db.insert(debateRounds).values({
    debateId: debate.id,
    roundNumber: 1,
  });
  
  console.log(`   ✅ Debate created: ${thread.slug}`);
  return thread.slug;
}

export async function createThreadFromTopic(topic: string, categorySlug?: string): Promise<string | null> {
  console.log(`\n💬 Creating thread from topic: ${topic}`);
  
  const allPersonas = await db.select().from(personas);
  const persona = allPersonas[Math.floor(Math.random() * allPersonas.length)];
  
  const catSlug = categorySlug || ['trading', 'ai-automation', 'ecommerce', 'content', 'freelancing'][Math.floor(Math.random() * 5)];
  const [category] = await db.select().from(categories).where(eq(categories.slug, catSlug)).limit(1);
  if (!category) return null;
  
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '-' + Math.random().toString(36).slice(2, 10);
  
  const [thread] = await db.insert(threads).values({
    title: topic,
    slug,
    summary: topic,
    categoryId: category.id,
    starterPersonaId: persona.id,
    isDebate: false,
    postCount: 1,
  }).returning();
  
  const content = await generatePost({ personaId: persona.id, topic, isOpener: true });
  
  await db.insert(posts).values({
    threadId: thread.id,
    personaId: persona.id,
    content: content || topic,
  });
  
  await db.update(personas)
    .set({ totalPosts: sql`${personas.totalPosts} + 1` })
    .where(eq(personas.id, persona.id));
  
  console.log(`   ✅ Thread created: ${thread.slug}`);
  return thread.slug;
}

export async function advanceDebateRound(debateId: string): Promise<void> {
  const [debate] = await db.select().from(debates).where(eq(debates.id, debateId)).limit(1);
  if (!debate || debate.status !== 'active') {
    throw new Error('Debate not found or not active');
  }
  
  await progressDebate(debate.id);
}
