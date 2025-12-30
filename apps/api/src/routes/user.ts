import { Hono } from 'hono';
import { db } from '../db/client.js';
import { users, userPersonas } from '../db/schema.js';
import { eq } from 'drizzle-orm';

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
