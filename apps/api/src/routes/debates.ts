import { Hono } from 'hono';
import { db } from '../db/client.js';
import { debates, personas, debateRounds, posts, threads } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export const debatesRoutes = new Hono();

// GET /api/debates
debatesRoutes.get('/', async (c) => {
  try {
    const status = c.req.query('status');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    
    const persona1 = alias(personas, 'persona1');
    const persona2 = alias(personas, 'persona2');
    
    let conditions = [];
    if (status) {
      conditions.push(eq(debates.status, status));
    }
    
    const result = await db
      .select({
        id: debates.id,
        topic: debates.topic,
        description: debates.description,
        status: debates.status,
        totalRounds: debates.totalRounds,
        currentRound: debates.currentRound,
        persona1Votes: debates.persona1Votes,
        persona2Votes: debates.persona2Votes,
        eloChange: debates.eloChange,
        createdAt: debates.createdAt,
        completedAt: debates.completedAt,
        threadId: debates.threadId,
        persona1: {
          id: persona1.id,
          name: persona1.name,
          slug: persona1.slug,
          avatarUrl: persona1.avatarUrl,
          eloRating: persona1.eloRating,
        },
        persona2: {
          id: persona2.id,
          name: persona2.name,
          slug: persona2.slug,
          avatarUrl: persona2.avatarUrl,
          eloRating: persona2.eloRating,
        },
      })
      .from(debates)
      .leftJoin(persona1, eq(debates.persona1Id, persona1.id))
      .leftJoin(persona2, eq(debates.persona2Id, persona2.id))
      .where(status ? eq(debates.status, status) : undefined)
      .orderBy(desc(debates.createdAt))
      .limit(limit);
    
    return c.json({ data: result });
  } catch (error: any) {
    console.error('Debates fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/debates/:id
debatesRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Get debate
    const debate = await db
      .select()
      .from(debates)
      .where(eq(debates.id, id))
      .limit(1);
    
    if (debate.length === 0) {
      return c.json({ error: 'Debate not found' }, 404);
    }
    
    // Get personas
    const [persona1Data, persona2Data] = await Promise.all([
      db.select().from(personas).where(eq(personas.id, debate[0].persona1Id)).limit(1),
      db.select().from(personas).where(eq(personas.id, debate[0].persona2Id)).limit(1),
    ]);
    
    // Get rounds with posts
    const rounds = await db
      .select()
      .from(debateRounds)
      .where(eq(debateRounds.debateId, id))
      .orderBy(debateRounds.roundNumber);
    
    // Get posts for each round
    const roundsWithPosts = await Promise.all(
      rounds.map(async (round) => {
        const [post1, post2] = await Promise.all([
          round.persona1PostId 
            ? db.select().from(posts).where(eq(posts.id, round.persona1PostId)).limit(1)
            : Promise.resolve([]),
          round.persona2PostId
            ? db.select().from(posts).where(eq(posts.id, round.persona2PostId)).limit(1)
            : Promise.resolve([]),
        ]);
        
        return {
          ...round,
          persona1Post: post1[0] || null,
          persona2Post: post2[0] || null,
        };
      })
    );
    
    // Get thread info
    let thread = null;
    if (debate[0].threadId) {
      const threadData = await db
        .select({ slug: threads.slug })
        .from(threads)
        .where(eq(threads.id, debate[0].threadId))
        .limit(1);
      thread = threadData[0] || null;
    }
    
    return c.json({
      debate: debate[0],
      persona1: persona1Data[0],
      persona2: persona2Data[0],
      rounds: roundsWithPosts,
      thread,
    });
  } catch (error: any) {
    console.error('Debate fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/debates/:id/vote
debatesRoutes.post('/:id/vote', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { visitorId, personaId } = body;
    
    if (!visitorId || !personaId) {
      return c.json({ error: 'visitorId and personaId required' }, 400);
    }
    
    // Get debate
    const debate = await db
      .select()
      .from(debates)
      .where(eq(debates.id, id))
      .limit(1);
    
    if (!debate.length) {
      return c.json({ error: 'Debate not found' }, 404);
    }
    
    if (debate[0].status !== 'active' && debate[0].status !== 'voting') {
      return c.json({ error: 'Debate not accepting votes' }, 400);
    }
    
    // Check which persona was voted for
    const { votes } = await import('../db/schema.js');
    
    // Check if already voted
    const existing = await db
      .select()
      .from(votes)
      .where(sql`${votes.visitorId} = ${visitorId} AND ${votes.votableType} = 'debate' AND ${votes.votableId} = ${id}`)
      .limit(1);
    
    if (existing.length) {
      return c.json({ error: 'Already voted on this debate' }, 400);
    }
    
    // Record vote
    await db.insert(votes).values({
      visitorId,
      votableType: 'debate',
      votableId: id,
      value: 1,
      votedPersonaId: personaId,
    });
    
    // Update debate vote counts
    if (personaId === debate[0].persona1Id) {
      await db
        .update(debates)
        .set({ persona1Votes: sql`${debates.persona1Votes} + 1` })
        .where(eq(debates.id, id));
    } else if (personaId === debate[0].persona2Id) {
      await db
        .update(debates)
        .set({ persona2Votes: sql`${debates.persona2Votes} + 1` })
        .where(eq(debates.id, id));
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Debate vote error:', error);
    return c.json({ error: error.message }, 500);
  }
});
