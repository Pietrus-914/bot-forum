import { Hono } from 'hono';
import { db } from '../db/client.js';
import { users, userPersonas, threads, posts, userPosts, userThreads, categories } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';

// Simple base64 encoding for API keys (in production use proper encryption)
function encryptKey(text: string): string {
  return Buffer.from(text).toString('base64');
}

function decryptKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf8');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50) + '-' + Math.random().toString(36).slice(2, 8);
}

export const userRoutes = new Hono();

// Get user's persona
userRoutes.get('/persona', async (c) => {
  const email = c.req.query('email');
  
  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  const [user] = await db.select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const [persona] = await db.select()
    .from(userPersonas)
    .where(eq(userPersonas.userId, user.id))
    .limit(1);

  if (!persona) {
    return c.json({ persona: null });
  }

  return c.json({
    persona: {
      id: persona.id,
      name: persona.name,
      slug: persona.slug,
      bio: persona.bio,
      systemPrompt: persona.systemPrompt,
      apiProvider: persona.apiProvider,
      hasApiKey: !!persona.apiKey,
      modelId: persona.modelId,
      isActive: persona.isActive,
      responseFrequency: persona.responseFrequency,
      responseMode: persona.responseMode,
      postCount: persona.postCount,
      createdAt: persona.createdAt,
    },
  });
});

// Create persona
userRoutes.post('/persona', async (c) => {
  try {
    const body = await c.req.json();
    const { email, name, bio, systemPrompt, apiProvider, apiKey, modelId, isActive, responseFrequency, responseMode } = body;

    if (!email || !name) {
      return c.json({ error: 'Email and name are required' }, 400);
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.isBanned) {
      return c.json({ error: 'Your account is suspended' }, 403);
    }

    const [existing] = await db.select()
      .from(userPersonas)
      .where(eq(userPersonas.userId, user.id))
      .limit(1);

    if (existing) {
      return c.json({ error: 'You already have a persona. Use PUT to update.' }, 400);
    }

    const [persona] = await db.insert(userPersonas)
      .values({
        userId: user.id,
        name,
        slug: slugify(name),
        bio,
        systemPrompt,
        apiProvider,
        apiKey: apiKey ? encryptKey(apiKey) : null,
        modelId,
        isActive: isActive && !!apiKey,
        responseFrequency: responseFrequency || 60,
        responseMode: responseMode || 'random',
      })
      .returning();

    return c.json({
      success: true,
      persona: {
        id: persona.id,
        name: persona.name,
        slug: persona.slug,
      },
    });
  } catch (error: any) {
    console.error('Create persona error:', error);
    return c.json({ error: 'Failed to create persona' }, 500);
  }
});

// Update persona
userRoutes.put('/persona', async (c) => {
  try {
    const body = await c.req.json();
    const { email, name, bio, systemPrompt, apiProvider, apiKey, modelId, isActive, responseFrequency, responseMode } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.isBanned) {
      return c.json({ error: 'Your account is suspended' }, 403);
    }

    const [existing] = await db.select()
      .from(userPersonas)
      .where(eq(userPersonas.userId, user.id))
      .limit(1);

    if (!existing) {
      return c.json({ error: 'No persona found. Use POST to create.' }, 404);
    }

    const updateData: any = {
      name: name || existing.name,
      bio,
      systemPrompt,
      apiProvider: apiProvider || existing.apiProvider,
      modelId: modelId || existing.modelId,
      responseFrequency: responseFrequency || existing.responseFrequency,
      responseMode: responseMode || existing.responseMode,
      updatedAt: new Date(),
    };

    if (apiKey) {
      updateData.apiKey = encryptKey(apiKey);
    }

    const hasApiKey = apiKey || existing.apiKey;
    updateData.isActive = isActive && hasApiKey;

    const [persona] = await db.update(userPersonas)
      .set(updateData)
      .where(eq(userPersonas.id, existing.id))
      .returning();

    return c.json({
      success: true,
      persona: {
        id: persona.id,
        name: persona.name,
        slug: persona.slug,
      },
    });
  } catch (error: any) {
    console.error('Update persona error:', error);
    return c.json({ error: 'Failed to update persona' }, 500);
  }
});

// Delete API key
userRoutes.delete('/persona/api-key', async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    await db.update(userPersonas)
      .set({
        apiKey: null,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(userPersonas.userId, user.id));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete API key error:', error);
    return c.json({ error: 'Failed to delete API key' }, 500);
  }
});

// ==========================================
// USER POSTS
// ==========================================


// Validate content - no links or attachments
function validateContent(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length < 10) {
    return { valid: false, error: 'Content must be at least 10 characters' };
  }
  if (content.length > 5000) {
    return { valid: false, error: 'Content must be less than 5000 characters' };
  }
  
  // Check for links
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\[.*\]\(.*\))/gi;
  if (urlRegex.test(content)) {
    return { valid: false, error: 'Links are not allowed in posts' };
  }
  
  // Check for common file extensions (attachments)
  const fileRegex = /\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|zip|rar|exe|mp3|mp4|mov)(\s|$)/gi;
  if (fileRegex.test(content)) {
    return { valid: false, error: 'File attachments are not allowed' };
  }
  
  return { valid: true };
}

// Check cooldown (1 minute)
async function checkCooldown(userId: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user?.lastPostAt) {
    return { allowed: true };
  }
  
  const cooldownMs = 60 * 1000; // 1 minute
  const timeSinceLastPost = Date.now() - new Date(user.lastPostAt).getTime();
  
  if (timeSinceLastPost < cooldownMs) {
    return { 
      allowed: false, 
      waitSeconds: Math.ceil((cooldownMs - timeSinceLastPost) / 1000) 
    };
  }
  
  return { allowed: true };
}

// Create a reply to a thread
userRoutes.post('/posts', async (c) => {
  try {
    const body = await c.req.json();
    const { email, threadId, content } = body;

    if (!email || !threadId || !content) {
      return c.json({ error: 'Email, threadId, and content are required' }, 400);
    }

    // Get user
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.isBanned) {
      return c.json({ error: 'Your account is suspended', banReason: user.banReason }, 403);
    }

    // Check cooldown
    const cooldown = await checkCooldown(user.id);
    if (!cooldown.allowed) {
      return c.json({ 
        error: `Please wait ${cooldown.waitSeconds} seconds before posting again` 
      }, 429);
    }

    // Validate content
    const validation = validateContent(content);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    // Check thread exists
    const [thread] = await db.select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1);

    if (!thread) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    // Create user post
    const [userPost] = await db.insert(userPosts)
      .values({
        userId: user.id,
        threadId,
        content: content.trim(),
      })
      .returning();

    // Update user's lastPostAt
    await db.update(users)
      .set({ lastPostAt: new Date() })
      .where(eq(users.id, user.id));

    // Update thread postCount and lastActivityAt
    await db.update(threads)
      .set({ 
        postCount: sql`${threads.postCount} + 1`,
        lastActivityAt: new Date(),
      })
      .where(eq(threads.id, threadId));

    return c.json({
      success: true,
      post: {
        id: userPost.id,
        content: userPost.content,
        createdAt: userPost.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Create post error:', error);
    return c.json({ error: 'Failed to create post' }, 500);
  }
});

// Create a new thread
userRoutes.post('/threads', async (c) => {
  try {
    const body = await c.req.json();
    const { email, title, content, categorySlug } = body;

    if (!email || !title || !content) {
      return c.json({ error: 'Email, title, and content are required' }, 400);
    }

    if (title.length < 10 || title.length > 150) {
      return c.json({ error: 'Title must be between 10 and 150 characters' }, 400);
    }

    // Get user
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.isBanned) {
      return c.json({ error: 'Your account is suspended', banReason: user.banReason }, 403);
    }

    // Check cooldown
    const cooldown = await checkCooldown(user.id);
    if (!cooldown.allowed) {
      return c.json({ 
        error: `Please wait ${cooldown.waitSeconds} seconds before posting again` 
      }, 429);
    }

    // Validate content
    const validation = validateContent(content);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    // Validate title for links
    const titleValidation = validateContent(title + ' padding for length');
    if (!titleValidation.valid && titleValidation.error?.includes('Links')) {
      return c.json({ error: 'Links are not allowed in title' }, 400);
    }

    // Get category (default to general/trading)
    let categoryId: string | null = null;
    if (categorySlug) {
      const [category] = await db.select()
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      categoryId = category?.id || null;
    }

    // Create slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50) + '-' + Math.random().toString(36).slice(2, 10);

    // Create thread
    const [thread] = await db.insert(threads)
      .values({
        title,
        slug,
        categoryId,
        postCount: 1,
        isUserThread: true,
      })
      .returning();

    // Create first post (user post)
    const [userPost] = await db.insert(userPosts)
      .values({
        userId: user.id,
        threadId: thread.id,
        content: content.trim(),
      })
      .returning();

    // Track user thread
    await db.insert(userThreads)
      .values({
        userId: user.id,
        threadId: thread.id,
      });

    // Update user's lastPostAt
    await db.update(users)
      .set({ lastPostAt: new Date() })
      .where(eq(users.id, user.id));

    return c.json({
      success: true,
      thread: {
        id: thread.id,
        slug: thread.slug,
        title: thread.title,
      },
    });
  } catch (error: any) {
    console.error('Create thread error:', error);
    return c.json({ error: 'Failed to create thread' }, 500);
  }
});

// Delete user's own post
userRoutes.delete('/posts/:postId', async (c) => {
  try {
    const postId = c.req.param('postId');
    const email = c.req.query('email');

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check if post belongs to user
    const [post] = await db.select()
      .from(userPosts)
      .where(eq(userPosts.id, postId))
      .limit(1);

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    if (post.userId !== user.id) {
      return c.json({ error: 'Not authorized to delete this post' }, 403);
    }

    // Delete the post
    await db.delete(userPosts).where(eq(userPosts.id, postId));

    // Update thread post count
    await db.update(threads)
      .set({ postCount: sql`${threads.postCount} - 1` })
      .where(eq(threads.id, post.threadId));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete post error:', error);
    return c.json({ error: 'Failed to delete post' }, 500);
  }
});
