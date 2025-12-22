import { Hono } from 'hono';
import { generateThread, createDebate, completeDebate } from '../services/orchestrator.js';
import { runCronCycle } from '../services/cron-v2.js';
import { db } from '../db/client.js';
import { threads, debates, categories, personas, teams } from '../db/schema.js';
import { sql, eq } from 'drizzle-orm';

export const adminRoutes = new Hono();

// Verify cron secret
const verifyCronSecret = (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const secret = authHeader?.replace('Bearer ', '') || c.req.header('x-cron-secret') || c.req.query('secret');
  const expectedSecret = process.env.CRON_SECRET || 'dev-secret';
  
  if (secret !== expectedSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  return next();
};

// POST /api/admin/cron-v2 - run v2 cron cycle (used by GitHub Actions)
adminRoutes.post('/cron-v2', verifyCronSecret, async (c) => {
  try {
    console.log('🚀 Admin: Running cron-v2 cycle...');
    await runCronCycle();
    return c.json({ success: true, message: 'Cron cycle completed' });
  } catch (error: any) {
    console.error('Cron-v2 error:', error);
    return c.json({ error: error.message }, 500);
  }
});

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
    const [teamCount] = await db.select({ count: sql<number>`count(*)` }).from(teams).where(eq(teams.isActive, true));
    
    return c.json({
      threads: Number(threadCount?.count || 0),
      debates: Number(debateCount?.count || 0),
      categories: Number(categoryCount?.count || 0),
      personas: Number(personaCount?.count || 0),
      teams: Number(teamCount?.count || 0),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Fix debates without teams
adminRoutes.post('/fix-debate-teams', async (c) => {
  try {
    const { debates, personas } = await import('../db/schema.js');
    const { db } = await import('../db/client.js');
    const { eq, isNull } = await import('drizzle-orm');
    
    // Get debates without teams
    const debatesWithoutTeams = await db.select()
      .from(debates)
      .where(isNull(debates.team1Id));
    
    let fixed = 0;
    for (const debate of debatesWithoutTeams) {
      const [p1] = await db.select().from(personas).where(eq(personas.id, debate.persona1Id)).limit(1);
      const [p2] = await db.select().from(personas).where(eq(personas.id, debate.persona2Id)).limit(1);
      
      if (p1?.teamId && p2?.teamId) {
        await db.update(debates)
          .set({ 
            team1Id: p1.teamId,
            team2Id: p2.teamId 
          })
          .where(eq(debates.id, debate.id));
        fixed++;
      }
    }
    
    return c.json({ success: true, fixed, total: debatesWithoutTeams.length });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Recalculate team wins from completed debates
adminRoutes.post('/recalculate-team-wins', async (c) => {
  try {
    const { debates, teams, personas } = await import('../db/schema.js');
    const { db } = await import('../db/client.js');
    const { eq, sql } = await import('drizzle-orm');
    
    // Reset all team wins
    await db.update(teams).set({ debatesWon: 0, debatesLost: 0 });
    
    // Get all completed debates with winners
    const completedDebates = await db.select()
      .from(debates)
      .where(eq(debates.status, 'completed'));
    
    let updated = 0;
    for (const debate of completedDebates) {
      if (!debate.winnerId) continue;
      
      // Get winner's team
      const [winner] = await db.select().from(personas).where(eq(personas.id, debate.winnerId)).limit(1);
      if (!winner?.teamId) continue;
      
      // Get loser's team
      const loserId = debate.winnerId === debate.persona1Id ? debate.persona2Id : debate.persona1Id;
      const [loser] = await db.select().from(personas).where(eq(personas.id, loserId)).limit(1);
      
      // Update winner team
      await db.update(teams)
        .set({ debatesWon: sql`${teams.debatesWon} + 1` })
        .where(eq(teams.id, winner.teamId));
      
      // Update loser team
      if (loser?.teamId) {
        await db.update(teams)
          .set({ debatesLost: sql`${teams.debatesLost} + 1` })
          .where(eq(teams.id, loser.teamId));
      }
      
      updated++;
    }
    
    // Get updated teams
    const updatedTeams = await db.select({ name: teams.name, won: teams.debatesWon, lost: teams.debatesLost }).from(teams);
    
    return c.json({ success: true, debatesProcessed: updated, teams: updatedTeams });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Fix existing debate summaries - change author to AI Admin
adminRoutes.post('/fix-debate-summaries', async (c) => {
  try {
    const { posts, personas, debates } = await import('../db/schema.js');
    const { db } = await import('../db/client.js');
    const { eq, and } = await import('drizzle-orm');
    
    // Get AI Admin
    const [aiAdmin] = await db.select().from(personas).where(eq(personas.slug, 'ai-admin')).limit(1);
    if (!aiAdmin) {
      return c.json({ error: 'AI Admin persona not found' }, 404);
    }
    
    // Find all admin posts (debate summaries)
    const adminPosts = await db.select()
      .from(posts)
      .where(eq(posts.isAdminPost, true));
    
    // Update them to AI Admin
    let updated = 0;
    for (const post of adminPosts) {
      if (post.personaId !== aiAdmin.id) {
        await db.update(posts)
          .set({ personaId: aiAdmin.id })
          .where(eq(posts.id, post.id));
        updated++;
      }
    }
    
    return c.json({ success: true, updated, total: adminPosts.length, aiAdminId: aiAdmin.id });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
