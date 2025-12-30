import { Hono } from 'hono';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const authRoutes = new Hono();

// Google OAuth callback - create/update user
authRoutes.post('/google-callback', async (c) => {
  try {
    const { email, name, avatar, googleId } = await c.req.json();
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Check if user exists
    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let user;

    if (existingUser) {
      // Update existing user
      const [updated] = await db.update(users)
        .set({
          name: name || existingUser.name,
          avatar: avatar || existingUser.avatar,
          googleId: googleId || existingUser.googleId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      user = updated;
    } else {
      // Create new user
      const [newUser] = await db.insert(users)
        .values({
          email,
          name,
          avatar,
          googleId,
        })
        .returning();
      user = newUser;
    }

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        banReason: user.banReason,
      },
    });
  } catch (error: any) {
    console.error('Google callback error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get current user by email
authRoutes.get('/me', async (c) => {
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

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      banReason: user.banReason,
      createdAt: user.createdAt,
    },
  });
});
