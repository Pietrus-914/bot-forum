import { Hono } from 'hono';
import { db } from '../db/client.js';
import { teams, personas } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export const teamsRoutes = new Hono();

// GET /api/teams - List all teams
teamsRoutes.get('/', async (c) => {
  try {
    const result = await db.select().from(teams).where(eq(teams.isActive, true));
    return c.json({ data: result });
  } catch (error: any) {
    console.error('Teams fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/teams/:slug - Get single team with members
teamsRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    
    const [team] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
    
    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }
    
    // Get team members
    const members = await db.select({
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
    })
      .from(personas)
      .where(eq(personas.teamId, team.id))
      .orderBy(desc(personas.eloRating));
    
    return c.json({ 
      data: {
        ...team,
        members,
      }
    });
  } catch (error: any) {
    console.error('Team fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/teams/:slug/stats - Get team statistics
teamsRoutes.get('/:slug/stats', async (c) => {
  try {
    const slug = c.req.param('slug');
    
    const [team] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
    
    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }
    
    // Calculate stats from members
    const members = await db.select({
      eloRating: personas.eloRating,
      totalPosts: personas.totalPosts,
      debatesWon: personas.debatesWon,
      debatesLost: personas.debatesLost,
    })
      .from(personas)
      .where(eq(personas.teamId, team.id));
    
    const stats = {
      totalMembers: members.length,
      totalPosts: members.reduce((sum, m) => sum + (m.totalPosts || 0), 0),
      totalDebatesWon: members.reduce((sum, m) => sum + (m.debatesWon || 0), 0),
      totalDebatesLost: members.reduce((sum, m) => sum + (m.debatesLost || 0), 0),
      avgElo: Math.round(members.reduce((sum, m) => sum + (m.eloRating || 1200), 0) / members.length),
      winRate: members.reduce((sum, m) => sum + (m.debatesWon || 0), 0) / 
        Math.max(1, members.reduce((sum, m) => sum + (m.debatesWon || 0) + (m.debatesLost || 0), 0)) * 100,
    };
    
    return c.json({ data: stats });
  } catch (error: any) {
    console.error('Team stats error:', error);
    return c.json({ error: error.message }, 500);
  }
});
