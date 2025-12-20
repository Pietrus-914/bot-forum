import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db/client.js';
import { votes, posts, personas } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export const votesRoutes = new Hono();

const voteSchema = z.object({
  visitorId: z.string().min(10),
  votableType: z.enum(['post', 'debate']),
  votableId: z.string().uuid(),
  value: z.number().min(-1).max(1),
  votedPersonaId: z.string().uuid().optional(),
});

// POST /api/votes
votesRoutes.post('/', zValidator('json', voteSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    
    // Check if already voted
    const existing = await db
      .select()
      .from(votes)
      .where(and(
        eq(votes.visitorId, data.visitorId),
        eq(votes.votableType, data.votableType),
        eq(votes.votableId, data.votableId)
      ))
      .limit(1);
    
    const previousValue = existing[0]?.value || 0;
    
    if (existing.length > 0) {
      if (data.value === 0) {
        // Remove vote
        await db.delete(votes).where(eq(votes.id, existing[0].id));
      } else {
        // Update existing vote
        await db
          .update(votes)
          .set({ value: data.value, votedPersonaId: data.votedPersonaId })
          .where(eq(votes.id, existing[0].id));
      }
    } else if (data.value !== 0) {
      // Insert new vote
      await db.insert(votes).values({
        visitorId: data.visitorId,
        votableType: data.votableType,
        votableId: data.votableId,
        value: data.value,
        votedPersonaId: data.votedPersonaId,
      });
    }
    
    // Update vote counts on post
    if (data.votableType === 'post') {
      const upvotesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(and(
          eq(votes.votableType, 'post'),
          eq(votes.votableId, data.votableId),
          eq(votes.value, 1)
        ));
      
      const downvotesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(and(
          eq(votes.votableType, 'post'),
          eq(votes.votableId, data.votableId),
          eq(votes.value, -1)
        ));
      
      await db
        .update(posts)
        .set({ 
          upvotes: Number(upvotesCount[0]?.count || 0),
          downvotes: Number(downvotesCount[0]?.count || 0),
        })
        .where(eq(posts.id, data.votableId));
      
      // Update persona total upvotes
      const post = await db
        .select({ personaId: posts.personaId })
        .from(posts)
        .where(eq(posts.id, data.votableId))
        .limit(1);
      
      if (post.length && data.value === 1 && previousValue !== 1) {
        await db
          .update(personas)
          .set({ totalUpvotes: sql`${personas.totalUpvotes} + 1` })
          .where(eq(personas.id, post[0].personaId));
      } else if (post.length && previousValue === 1 && data.value !== 1) {
        await db
          .update(personas)
          .set({ totalUpvotes: sql`GREATEST(${personas.totalUpvotes} - 1, 0)` })
          .where(eq(personas.id, post[0].personaId));
      }
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Vote error:', error);
    return c.json({ error: 'Failed to vote' }, 500);
  }
});

// GET /api/votes/check - check if user already voted
votesRoutes.get('/check', async (c) => {
  try {
    const visitorId = c.req.query('visitorId');
    const votableType = c.req.query('votableType');
    const votableId = c.req.query('votableId');
    
    if (!visitorId || !votableType || !votableId) {
      return c.json({ error: 'Missing parameters' }, 400);
    }
    
    const existing = await db
      .select({ value: votes.value, votedPersonaId: votes.votedPersonaId })
      .from(votes)
      .where(and(
        eq(votes.visitorId, visitorId),
        eq(votes.votableType, votableType),
        eq(votes.votableId, votableId)
      ))
      .limit(1);
    
    return c.json({ 
      voted: existing.length > 0,
      value: existing[0]?.value || 0,
      votedPersonaId: existing[0]?.votedPersonaId || null,
    });
  } catch (error: any) {
    console.error('Vote check error:', error);
    return c.json({ error: error.message }, 500);
  }
});
