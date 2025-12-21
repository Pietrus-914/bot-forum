import { db } from '../db/client.js';
import { threads, posts, personas, categories, debates, debateRounds } from '../db/schema.js';
import { eq, sql, and } from 'drizzle-orm';
import { generateTopic, generateDebateTopic } from './topic-generator.js';
import { generatePost, generateDebateArgument } from './post-generator.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100);
}

export async function generateThread(): Promise<typeof threads.$inferSelect> {
  console.log('🤖 Generating new thread...');
  
  // 1. Generate topic
  const topic = await generateTopic();
  console.log(`📝 Topic: ${topic.title}`);
  
  // 2. Get category
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, topic.categorySlug))
    .limit(1);
  
  if (!category.length) {
    // Fallback to first category
    const fallback = await db.select().from(categories).limit(1);
    if (!fallback.length) throw new Error('No categories found');
    category[0] = fallback[0];
  }
  
  // 3. Get starter persona
  const personaSlug = topic.suggestedPersonas[0] || 'practical-mind';
  let starterPersona = await db
    .select()
    .from(personas)
    .where(eq(personas.slug, personaSlug))
    .limit(1);
  
  if (!starterPersona.length) {
    // Fallback to any active persona
    starterPersona = await db
      .select()
      .from(personas)
      .where(eq(personas.isActive, true))
      .limit(1);
  }
  
  if (!starterPersona.length) {
    throw new Error('No personas found');
  }
  
  // 4. Generate opening post
  const modelShort = starterPersona[0].modelName?.split('/').pop() || 'unknown';
  console.log(`🎭 Generating opening from ${starterPersona[0].name} (${modelShort})...`);
  const openingContent = await generatePost({
    personaId: starterPersona[0].id,
    topic: topic.title,
    isOpener: true,
  });
  
  // 5. Create thread
  const slug = slugify(topic.title) + '-' + Date.now().toString(36);
  
  const [newThread] = await db
    .insert(threads)
    .values({
      title: topic.title,
      slug,
      summary: topic.summary,
      categoryId: category[0].id,
      starterPersonaId: starterPersona[0].id,
      isDebate: false,
      postCount: 1,
    })
    .returning();
  
  // 6. Create opening post
  await db.insert(posts).values({
    threadId: newThread.id,
    personaId: starterPersona[0].id,
    content: openingContent,
  });
  
  // 7. Update category count
  await db
    .update(categories)
    .set({ threadCount: sql`${categories.threadCount} + 1` })
    .where(eq(categories.id, category[0].id));
  
  // 8. Update persona stats
  await db
    .update(personas)
    .set({ totalPosts: sql`${personas.totalPosts} + 1` })
    .where(eq(personas.id, starterPersona[0].id));
  
  console.log(`✅ Thread created: ${newThread.slug}`);
  
  // 9. Generate 2-3 follow-up responses
  const respondingPersonas = topic.suggestedPersonas.slice(1, 4);
  await generateResponses(newThread.id, topic.title, respondingPersonas);
  
  return newThread;
}

async function generateResponses(
  threadId: string,
  topic: string,
  personaSlugs: string[]
) {
  for (const slug of personaSlugs) {
    try {
      // Get persona
      const persona = await db
        .select()
        .from(personas)
        .where(eq(personas.slug, slug))
        .limit(1);
      
      if (!persona.length) continue;
      
      // Get existing posts for context
      const existingPosts = await db
        .select({ 
          content: posts.content,
          personaId: posts.personaId 
        })
        .from(posts)
        .where(eq(posts.threadId, threadId));
      
      // Build context with persona names
      let context = '';
      for (const p of existingPosts) {
        const postPersona = await db
          .select({ name: personas.name })
          .from(personas)
          .where(eq(personas.id, p.personaId))
          .limit(1);
        context += `[${postPersona[0]?.name || 'Unknown'}]:\n${p.content}\n\n---\n\n`;
      }
      
      console.log(`🎭 Generating response from ${persona[0].name} (${persona[0].modelName?.split('/').pop()})...`);
      
      // Generate response with existingPostsCount
      const content = await generatePost({
        personaId: persona[0].id,
        topic,
        context,
        isOpener: false,
        existingPostsCount: existingPosts.length,
      });
      
      // Create post with offset timestamp (posts come after thread opener)
      const baseOffset = 5 + (personaSlugs.indexOf(slug) * 10); // 5, 15, 25 minutes etc
      const randomOffset = Math.floor(Math.random() * 10); // +0-10 minutes randomness
      const totalMinutes = baseOffset + randomOffset;
      
      await db.insert(posts).values({
        threadId,
        personaId: persona[0].id,
        content,
      });
      
      // Update thread
      await db
        .update(threads)
        .set({ 
          postCount: sql`${threads.postCount} + 1`,
          lastActivityAt: new Date(),
        })
        .where(eq(threads.id, threadId));
      
      // Update persona stats
      await db
        .update(personas)
        .set({ totalPosts: sql`${personas.totalPosts} + 1` })
        .where(eq(personas.id, persona[0].id));
      
      console.log(`  ↳ Response from ${persona[0].name} added`);
      
      // Random delay 2-8 minutes between posts (simulates real forum)
      const delayMinutes = Math.floor(Math.random() * 6) + 2;
      const delayMs = delayMinutes * 60 * 1000;
      console.log(`  ⏳ Waiting ${delayMinutes} minutes before next response...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 5000))); // Cap at 5s for dev
    } catch (error) {
      console.error(`Error generating response from ${slug}:`, error);
    }
  }
}

export async function createDebate(options?: { rounds?: number }): Promise<typeof debates.$inferSelect> {
  const totalRounds = options?.rounds || 3; // Default 3 rounds = 6 posts
  console.log(`🥊 Creating debate (${totalRounds} rounds)...`);
  
  // 1. Generate topic
  const { topic, description, categorySlug } = await generateDebateTopic();
  console.log(`⚔️ Debate: ${topic}`);
  
  // 2. Get category
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);
  
  // 3. Select two random personas
  const allPersonas = await db
    .select()
    .from(personas)
    .where(eq(personas.isActive, true));
  
  const shuffled = allPersonas.sort(() => Math.random() - 0.5);
  const [persona1, persona2] = shuffled.slice(0, 2);
  
  if (!persona1 || !persona2) {
    throw new Error('Need at least 2 personas for debate');
  }
  
  // 4. Create thread for debate
  const slug = 'debate-' + slugify(topic) + '-' + Date.now().toString(36);
  
  const [thread] = await db
    .insert(threads)
    .values({
      title: `🥊 Debate: ${topic}`,
      slug,
      summary: description,
      categoryId: category[0]?.id || (await db.select().from(categories).limit(1))[0].id,
      starterPersonaId: persona1.id,
      isDebate: true,
      postCount: 0,
    })
    .returning();
  
  // 5. Create debate
  const [debate] = await db
    .insert(debates)
    .values({
      topic,
      description,
      threadId: thread.id,
      categoryId: category[0]?.id,
      persona1Id: persona1.id,
      persona2Id: persona2.id,
      persona1Stance: 'pro',
      persona2Stance: 'con',
      status: 'active',
      totalRounds,
      currentRound: 1,
    })
    .returning();
  
  // 6. Update thread with debate ID
  await db
    .update(threads)
    .set({ debateId: debate.id })
    .where(eq(threads.id, thread.id));
  
  // 7. Generate ALL rounds
  for (let round = 1; round <= totalRounds; round++) {
    await generateDebateRound(debate.id, round, persona1, persona2, topic, thread.id);
    
    // Small delay between rounds
    if (round < totalRounds) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ Debate created: ${topic} (${totalRounds} rounds, ${totalRounds * 2} posts)`);
  return debate;
}

async function generateDebateRound(
  debateId: string,
  roundNumber: number,
  persona1: typeof personas.$inferSelect,
  persona2: typeof personas.$inferSelect,
  topic: string,
  threadId: string
) {
  console.log(`📢 Generating round ${roundNumber}...`);
  
  // Get previous arguments for context
  let previousArgs = '';
  if (roundNumber > 1) {
    const prevPosts = await db
      .select({ content: posts.content, personaId: posts.personaId })
      .from(posts)
      .where(eq(posts.threadId, threadId));
    
    previousArgs = prevPosts.map(p => p.content).join('\n\n---\n\n');
  }
  
  // Generate arguments
  const model1Short = persona1.modelName?.split('/').pop() || 'unknown';
  const model2Short = persona2.modelName?.split('/').pop() || 'unknown';
  
  console.log(`  🎭 ${persona1.name} (PRO) [${model1Short}]...`);
  const arg1 = await generateDebateArgument(
    persona1.id,
    topic,
    'pro',
    previousArgs || undefined,
    roundNumber
  );
  
  console.log(`  🎭 ${persona2.name} (CON) [${model2Short}]...`);
  const arg2 = await generateDebateArgument(
    persona2.id,
    topic,
    'con',
    previousArgs ? previousArgs + '\n\n---\n\n' + arg1 : arg1,
    roundNumber
  );
  
  // Create posts
  const [post1] = await db.insert(posts).values({
    threadId,
    personaId: persona1.id,
    content: arg1,
  }).returning();
  
  const [post2] = await db.insert(posts).values({
    threadId,
    personaId: persona2.id,
    content: arg2,
  }).returning();
  
  // Create round record
  await db.insert(debateRounds).values({
    debateId,
    roundNumber,
    persona1PostId: post1.id,
    persona2PostId: post2.id,
  });
  
  // Update thread and debate
  await db
    .update(threads)
    .set({ 
      postCount: sql`${threads.postCount} + 2`,
      lastActivityAt: new Date(),
    })
    .where(eq(threads.id, threadId));
  
  await db
    .update(debates)
    .set({ currentRound: roundNumber })
    .where(eq(debates.id, debateId));
  
  // Update persona stats
  await db.update(personas).set({ totalPosts: sql`${personas.totalPosts} + 1` }).where(eq(personas.id, persona1.id));
  await db.update(personas).set({ totalPosts: sql`${personas.totalPosts} + 1` }).where(eq(personas.id, persona2.id));
  
  console.log(`  ✅ Round ${roundNumber} complete`);
}

export async function completeDebate(debateId: string): Promise<void> {
  const debate = await db
    .select()
    .from(debates)
    .where(eq(debates.id, debateId))
    .limit(1);
  
  if (!debate.length || debate[0].status === 'completed') return;
  
  const { persona1Id, persona2Id, persona1Votes, persona2Votes } = debate[0];
  
  // Determine winner
  let winnerId = null;
  let eloChange = 0;
  
  const totalVotes = (persona1Votes || 0) + (persona2Votes || 0);
  
  if (totalVotes > 0) {
    if ((persona1Votes || 0) > (persona2Votes || 0)) {
      winnerId = persona1Id;
      eloChange = Math.round(32 * (1 - (persona1Votes || 0) / totalVotes));
    } else if ((persona2Votes || 0) > (persona1Votes || 0)) {
      winnerId = persona2Id;
      eloChange = Math.round(32 * (1 - (persona2Votes || 0) / totalVotes));
    }
  }
  
  // Update debate
  await db
    .update(debates)
    .set({
      status: 'completed',
      winnerId,
      eloChange,
      completedAt: new Date(),
    })
    .where(eq(debates.id, debateId));
  
  // Update ELO ratings
  if (winnerId === persona1Id) {
    await db.update(personas).set({ 
      eloRating: sql`${personas.eloRating} + ${eloChange}`,
      debatesWon: sql`${personas.debatesWon} + 1`
    }).where(eq(personas.id, persona1Id));
    await db.update(personas).set({ 
      eloRating: sql`${personas.eloRating} - ${eloChange}`,
      debatesLost: sql`${personas.debatesLost} + 1`
    }).where(eq(personas.id, persona2Id));
  } else if (winnerId === persona2Id) {
    await db.update(personas).set({ 
      eloRating: sql`${personas.eloRating} + ${eloChange}`,
      debatesWon: sql`${personas.debatesWon} + 1`
    }).where(eq(personas.id, persona2Id));
    await db.update(personas).set({ 
      eloRating: sql`${personas.eloRating} - ${eloChange}`,
      debatesLost: sql`${personas.debatesLost} + 1`
    }).where(eq(personas.id, persona1Id));
  }
  
  console.log(`🏆 Debate completed. Winner: ${winnerId || 'Draw'}`);
}
