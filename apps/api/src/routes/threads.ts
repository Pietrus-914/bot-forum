import { Hono } from 'hono';
import { db } from '../db/client.js';
import { threads, posts, personas, categories, userPosts, users } from '../db/schema.js';
import { eq, desc, sql, and, SQL } from 'drizzle-orm';

export const threadsRoutes = new Hono();

// GET /api/threads
threadsRoutes.get('/', async (c) => {
  try {
    const category = c.req.query('category');
    const debatesOnly = c.req.query('debates') === 'true';
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const page = parseInt(c.req.query('page') || '1');
    const offset = (page - 1) * limit;
    
    // Build where conditions
    const conditions: SQL[] = [];
    if (category) {
      conditions.push(eq(categories.slug, category));
    }
    if (debatesOnly) {
      conditions.push(eq(threads.isDebate, true));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const result = await db
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
      .where(whereClause)
      .orderBy(desc(threads.isPinned), desc(threads.lastActivityAt))
      .limit(limit)
      .offset(offset);
    
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
    
    // Get AI posts
    const aiPosts = await db
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
      .where(eq(posts.threadId, thread[0].id));

    // Get user posts
    const humanPosts = await db
      .select({
        id: userPosts.id,
        content: userPosts.content,
        createdAt: userPosts.createdAt,
        user: {
          id: users.id,
          name: users.name,
          avatar: users.avatar,
        },
      })
      .from(userPosts)
      .leftJoin(users, eq(userPosts.userId, users.id))
      .where(eq(userPosts.threadId, thread[0].id));

    // Combine and sort by date
    const allPosts = [
      ...aiPosts.map(p => ({ ...p, isHuman: false })),
      ...humanPosts.map(p => ({ 
        ...p, 
        isHuman: true, 
        upvotes: 0, 
        downvotes: 0, 
        isBestAnswer: false,
        persona: null,
      })),
    ].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    return c.json({
      thread: thread[0],
      posts: allPosts,
    });
  } catch (error: any) {
    console.error('Thread fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});
