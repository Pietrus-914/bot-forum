import { Hono } from 'hono';
import { db } from '../db/client.js';
import { threads, posts, personas, categories } from '../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';

export const threadsRoutes = new Hono();

// GET /api/threads
threadsRoutes.get('/', async (c) => {
  try {
    const category = c.req.query('category');
    const debatesOnly = c.req.query('debates') === 'true';
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const page = parseInt(c.req.query('page') || '1');
    const offset = (page - 1) * limit;
    
    // Build conditions
    const conditions = [];
    if (debatesOnly) {
      conditions.push(eq(threads.isDebate, true));
    }
    
    let query = db
      .select({
        id: threads.id,
        title: threads.title,
        slug: threads.slug,
        summary: threads.summary,
        postCount: threads.postCount,
        upvotes: threads.upvotes,
        viewCount: threads.viewCount,
        isDebate: threads.isDebate,
        debateId: threads.debateId,
        isPinned: threads.isPinned,
        createdAt: threads.createdAt,
        lastActivityAt: threads.lastActivityAt,
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          icon: categories.icon,
        },
        starterPersona: {
          id: personas.id,
          name: personas.name,
          slug: personas.slug,
          avatarUrl: personas.avatarUrl,
        },
      })
      .from(threads)
      .leftJoin(categories, eq(threads.categoryId, categories.id))
      .leftJoin(personas, eq(threads.starterPersonaId, personas.id))
      .orderBy(desc(threads.isPinned), desc(threads.lastActivityAt))
      .limit(limit)
      .offset(offset);
    
    // Filter by category if provided
    if (category) {
      query = query.where(eq(categories.slug, category));
    }
    
    if (debatesOnly) {
      query = query.where(eq(threads.isDebate, true));
    }
    
    const result = await query;
    
    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(threads);
    const total = Number(countResult[0]?.count || 0);
    
    return c.json({ 
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Threads fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/threads/:slug
threadsRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    
    const thread = await db
      .select({
        id: threads.id,
        title: threads.title,
        slug: threads.slug,
        summary: threads.summary,
        postCount: threads.postCount,
        upvotes: threads.upvotes,
        viewCount: threads.viewCount,
        isDebate: threads.isDebate,
        debateId: threads.debateId,
        isPinned: threads.isPinned,
        createdAt: threads.createdAt,
        lastActivityAt: threads.lastActivityAt,
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          icon: categories.icon,
        },
        starterPersona: {
          id: personas.id,
          name: personas.name,
          slug: personas.slug,
          avatarUrl: personas.avatarUrl,
        },
      })
      .from(threads)
      .leftJoin(categories, eq(threads.categoryId, categories.id))
      .leftJoin(personas, eq(threads.starterPersonaId, personas.id))
      .where(eq(threads.slug, slug))
      .limit(1);
    
    if (thread.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }
    
    // Increment view count (fire and forget)
    db.update(threads)
      .set({ viewCount: sql`${threads.viewCount} + 1` })
      .where(eq(threads.id, thread[0].id))
      .execute()
      .catch(() => {});
    
    // Get posts
    const threadPosts = await db
      .select({
        id: posts.id,
        content: posts.content,
        upvotes: posts.upvotes,
        downvotes: posts.downvotes,
        isBestAnswer: posts.isBestAnswer,
        createdAt: posts.createdAt,
        persona: {
          id: personas.id,
          name: personas.name,
          slug: personas.slug,
          avatarUrl: personas.avatarUrl,
          eloRating: personas.eloRating,
        },
      })
      .from(posts)
      .leftJoin(personas, eq(posts.personaId, personas.id))
      .where(eq(posts.threadId, thread[0].id))
      .orderBy(posts.createdAt);
    
    return c.json({
      thread: thread[0],
      posts: threadPosts,
    });
  } catch (error: any) {
    console.error('Thread fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});
