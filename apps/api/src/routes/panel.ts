import { Hono } from 'hono';
import { db } from '../db/client.js';
import { 
  personas, teams, threads, debates, posts, categories,
  eloHistory, predictionVerifications 
} from '../db/schema.js';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

export const panelRoutes = new Hono();

const PANEL_PASSWORD = process.env.PANEL_PASSWORD || 'admin123';

// Auth middleware
const authMiddleware = async (c: any, next: any) => {
  const auth = c.req.header('X-Panel-Auth');
  if (auth !== PANEL_PASSWORD) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
};

panelRoutes.use('/*', authMiddleware);

// ==========================================
// TOPICS / TRENDS
// ==========================================

// Get trending topics from Twitter (via trends service)
panelRoutes.get('/topics', async (c) => {
  try {
    const { getTrendingTopics } = await import('../services/trends.js');
    const topics = await getTrendingTopics(20);
    
    // Get recently used topics (last 7 days)
    const recentThreads = await db.select({ title: threads.title })
      .from(threads)
      .where(gte(threads.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .orderBy(desc(threads.createdAt))
      .limit(50);
    
    const usedTitles = recentThreads.map(t => t.title.toLowerCase());
    
    return c.json({ 
      topics: topics.map(t => ({
        ...t,
        used: usedTitles.some(ut => ut.includes(t.topic?.toLowerCase() || ''))
      })),
      recentCount: recentThreads.length 
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Create thread/debate from topic
panelRoutes.post('/topics/create', async (c) => {
  try {
    const { topic, type, categorySlug } = await c.req.json();
    
    if (!topic || !type) {
      return c.json({ error: 'topic and type required' }, 400);
    }
    
    if (type === 'debate') {
      const { createDebateFromTopic } = await import('../services/cron-v2.js');
      const result = await createDebateFromTopic(topic);
      return c.json({ success: true, type: 'debate', result });
    } else {
      const { createThreadFromTopic } = await import('../services/cron-v2.js');
      const result = await createThreadFromTopic(topic, categorySlug);
      return c.json({ success: true, type: 'thread', result });
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// PERSONAS
// ==========================================

// Get all personas with details
panelRoutes.get('/personas', async (c) => {
  try {
    const allPersonas = await db.select({
      id: personas.id,
      name: personas.name,
      slug: personas.slug,
      role: personas.role,
      style: personas.style,
      systemPrompt: personas.systemPrompt,
      avatarUrl: personas.avatarUrl,
      eloRating: personas.eloRating,
      debatesWon: personas.debatesWon,
      debatesLost: personas.debatesLost,
      totalPosts: personas.totalPosts,
      teamId: personas.teamId,
    })
    .from(personas)
    .orderBy(desc(personas.eloRating));
    
    const allTeams = await db.select().from(teams);
    
    return c.json({ personas: allPersonas, teams: allTeams });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update persona
panelRoutes.put('/personas/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    
    const allowedFields = ['name', 'role', 'style', 'systemPrompt', 'avatarUrl', 'teamId'];
    const filtered: any = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }
    
    await db.update(personas).set(filtered).where(eq(personas.id, id));
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Create new persona
panelRoutes.post('/personas', async (c) => {
  try {
    const data = await c.req.json();
    
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const [newPersona] = await db.insert(personas).values({
      name: data.name,
      slug,
      role: data.role || 'Specialist',
      style: data.style || 'casual',
      systemPrompt: data.systemPrompt || '',
      avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${slug}`,
      teamId: data.teamId,
      eloRating: 1200,
    }).returning();
    
    return c.json({ success: true, persona: newPersona });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// DEBATES
// ==========================================

// Get all debates with details
panelRoutes.get('/debates', async (c) => {
  try {
    const allDebates = await db.select()
      .from(debates)
      .orderBy(desc(debates.createdAt))
      .limit(50);
    
    const debatesWithPersonas = await Promise.all(
      allDebates.map(async (debate) => {
        const [p1] = await db.select({ name: personas.name, slug: personas.slug })
          .from(personas).where(eq(personas.id, debate.persona1Id)).limit(1);
        const [p2] = await db.select({ name: personas.name, slug: personas.slug })
          .from(personas).where(eq(personas.id, debate.persona2Id)).limit(1);
        return { ...debate, persona1: p1, persona2: p2 };
      })
    );
    
    return c.json({ debates: debatesWithPersonas });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Advance debate round manually
panelRoutes.post('/debates/:id/advance', async (c) => {
  try {
    const id = c.req.param('id');
    const { advanceDebateRound } = await import('../services/cron-v2.js');
    await advanceDebateRound(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// PREDICTIONS
// ==========================================

// Get predictions pending verification
panelRoutes.get('/predictions', async (c) => {
  try {
    const predictionThreads = await db.select({
      id: threads.id,
      title: threads.title,
      slug: threads.slug,
      summary: threads.summary,
      createdAt: threads.createdAt,
    })
    .from(threads)
    .innerJoin(categories, eq(threads.categoryId, categories.id))
    .where(eq(categories.slug, 'predictions'))
    .orderBy(desc(threads.createdAt))
    .limit(100);
    
    // Get existing verifications
    const verifications = await db.select().from(predictionVerifications);
    const verifiedIds = new Set(verifications.map(v => v.threadId));
    
    return c.json({ 
      predictions: predictionThreads.map(p => ({
        ...p,
        verified: verifiedIds.has(p.id),
        verification: verifications.find(v => v.threadId === p.id)
      }))
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Verify prediction
panelRoutes.post('/predictions/:id/verify', async (c) => {
  try {
    const threadId = c.req.param('id');
    const { outcome, notes } = await c.req.json();
    
    if (!['correct', 'incorrect', 'partial'].includes(outcome)) {
      return c.json({ error: 'Invalid outcome' }, 400);
    }
    
    // Get thread and first post author
    const [thread] = await db.select().from(threads).where(eq(threads.id, threadId)).limit(1);
    if (!thread) return c.json({ error: 'Thread not found' }, 404);
    
    const [firstPost] = await db.select()
      .from(posts)
      .where(eq(posts.threadId, threadId))
      .orderBy(posts.createdAt)
      .limit(1);
    
    if (!firstPost) return c.json({ error: 'No posts found' }, 404);
    
    // Record verification
    await db.insert(predictionVerifications).values({
      threadId,
      outcome,
      adminNotes: notes,
    });
    
    // Update persona ELO based on outcome
    const eloChange = outcome === 'correct' ? 30 : outcome === 'partial' ? 10 : -20;
    
    await db.update(personas)
      .set({ eloRating: sql`${personas.eloRating} + ${eloChange}` })
      .where(eq(personas.id, firstPost.personaId));
    
    // Record ELO history
    const [persona] = await db.select().from(personas).where(eq(personas.id, firstPost.personaId)).limit(1);
    
    await db.insert(eloHistory).values({
      personaId: firstPost.personaId,
      eloRating: persona.eloRating,
      change: eloChange,
      reason: `prediction_${outcome}`,
    });
    
    return c.json({ success: true, eloChange, personaId: firstPost.personaId });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// STATS / ELO HISTORY
// ==========================================

// Get ELO history for charts
panelRoutes.get('/stats/elo-history', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const history = await db.select({
      personaId: eloHistory.personaId,
      eloRating: eloHistory.eloRating,
      change: eloHistory.change,
      reason: eloHistory.reason,
      recordedAt: eloHistory.recordedAt,
    })
    .from(eloHistory)
    .where(gte(eloHistory.recordedAt, since))
    .orderBy(eloHistory.recordedAt);
    
    // Group by persona
    const grouped: Record<string, any[]> = {};
    for (const h of history) {
      if (!grouped[h.personaId]) grouped[h.personaId] = [];
      grouped[h.personaId].push(h);
    }
    
    // Get persona names
    const allPersonas = await db.select({ id: personas.id, name: personas.name })
      .from(personas);
    const nameMap = Object.fromEntries(allPersonas.map(p => [p.id, p.name]));
    
    return c.json({ 
      history: grouped,
      personaNames: nameMap,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get general stats
panelRoutes.get('/stats', async (c) => {
  try {
    const [threadCount] = await db.select({ count: sql<number>`count(*)` }).from(threads);
    const [postCount] = await db.select({ count: sql<number>`count(*)` }).from(posts);
    const [debateCount] = await db.select({ count: sql<number>`count(*)` }).from(debates);
    const [completedDebates] = await db.select({ count: sql<number>`count(*)` })
      .from(debates).where(eq(debates.status, 'completed'));
    
    const topPersonas = await db.select({
      name: personas.name,
      eloRating: personas.eloRating,
      totalPosts: personas.totalPosts,
    })
    .from(personas)
    .orderBy(desc(personas.eloRating))
    .limit(10);
    
    return c.json({
      threads: threadCount.count,
      posts: postCount.count,
      debates: debateCount.count,
      completedDebates: completedDebates.count,
      topPersonas,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
