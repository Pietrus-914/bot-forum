import { Hono } from 'hono';
import { db } from '../db/client.js';
import { personas } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export const personasRoutes = new Hono();

// GET /api/personas
personasRoutes.get('/', async (c) => {
  try {
    const result = await db
      .select({
        id: personas.id,
        name: personas.name,
        slug: personas.slug,
        avatarUrl: personas.avatarUrl,
        description: personas.description,
        specialization: personas.primarySpecialization,
        eloRating: personas.eloRating,
        totalPosts: personas.totalPosts,
        debatesWon: personas.debatesWon,
        debatesLost: personas.debatesLost,
        teamId: personas.teamId,
      })
      .from(personas)
      .where(eq(personas.isActive, true))
      .orderBy(desc(personas.eloRating));
    
    return c.json({ data: result });
  } catch (error: any) {
    console.error('Personas fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/personas/:slug
personasRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    
    const result = await db
      .select({
        id: personas.id,
        name: personas.name,
        slug: personas.slug,
        avatarUrl: personas.avatarUrl,
        description: personas.description,
        specialization: personas.primarySpecialization,
        eloRating: personas.eloRating,
        totalPosts: personas.totalPosts,
        totalUpvotes: personas.totalUpvotes,
        debatesWon: personas.debatesWon,
        debatesLost: personas.debatesLost,
        createdAt: personas.createdAt,
      })
      .from(personas)
      .where(eq(personas.slug, slug))
      .limit(1);
    
    if (result.length === 0) {
      return c.json({ error: 'Persona not found' }, 404);
    }
    
    return c.json({ data: result[0] });
  } catch (error: any) {
    console.error('Persona fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/personas/:slug/posts - get posts by persona
personasRoutes.get('/:slug/posts', async (c) => {
  try {
    const slug = c.req.param('slug');
    const limit = parseInt(c.req.query('limit') || '20');
    
    const persona = await db
      .select({ id: personas.id })
      .from(personas)
      .where(eq(personas.slug, slug))
      .limit(1);
    
    if (!persona.length) {
      return c.json({ error: 'Persona not found' }, 404);
    }
    
    // Import posts here to avoid circular deps
    const { posts, threads } = await import('../db/schema.js');
    
    const result = await db
      .select({
        id: posts.id,
        content: posts.content,
        upvotes: posts.upvotes,
        createdAt: posts.createdAt,
        thread: {
          id: threads.id,
          title: threads.title,
          slug: threads.slug,
        }
      })
      .from(posts)
      .leftJoin(threads, eq(posts.threadId, threads.id))
      .where(eq(posts.personaId, persona[0].id))
      .orderBy(desc(posts.createdAt))
      .limit(limit);
    
    return c.json({ data: result });
  } catch (error: any) {
    console.error('Persona posts fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});
