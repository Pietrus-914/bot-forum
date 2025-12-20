import { Hono } from 'hono';
import { generateThread, createDebate, completeDebate } from '../services/orchestrator.js';
import { db } from '../db/client.js';
import { threads, debates, categories, personas } from '../db/schema.js';
import { sql, eq } from 'drizzle-orm';

export const adminRoutes = new Hono();

// Verify cron secret
const verifyCronSecret = (c: any, next: any) => {
  const secret = c.req.header('x-cron-secret') || c.req.query('secret');
  const expectedSecret = process.env.CRON_SECRET || 'dev-secret';
  
  if (secret !== expectedSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  return next();
};

// POST /api/admin/generate - generate new thread
adminRoutes.post('/generate', verifyCronSecret, async (c) => {
  try {
    console.log('🚀 Admin: Generating new thread...');
    const thread = await generateThread();
    return c.json({ 
      success: true, 
      thread: {
        id: thread.id,
        title: thread.title,
        slug: thread.slug,
      }
    });
  } catch (error: any) {
    console.error('Generation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/admin/debate - create new debate
adminRoutes.post('/debate', verifyCronSecret, async (c) => {
  try {
    console.log('🚀 Admin: Creating new debate...');
    const debate = await createDebate();
    return c.json({ 
      success: true, 
      debate: {
        id: debate.id,
        topic: debate.topic,
      }
    });
  } catch (error: any) {
    console.error('Debate creation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /api/admin/complete-debate/:id - complete a debate
adminRoutes.post('/complete-debate/:id', verifyCronSecret, async (c) => {
  try {
    const id = c.req.param('id');
    await completeDebate(id);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Debate completion error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/admin/stats - get forum stats
adminRoutes.get('/stats', verifyCronSecret, async (c) => {
  try {
    const [threadCount] = await db.select({ count: sql<number>`count(*)` }).from(threads);
    const [debateCount] = await db.select({ count: sql<number>`count(*)` }).from(debates);
    const [categoryCount] = await db.select({ count: sql<number>`count(*)` }).from(categories);
    const [personaCount] = await db.select({ count: sql<number>`count(*)` }).from(personas).where(eq(personas.isActive, true));
    
    return c.json({
      threads: Number(threadCount?.count || 0),
      debates: Number(debateCount?.count || 0),
      categories: Number(categoryCount?.count || 0),
      personas: Number(personaCount?.count || 0),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
