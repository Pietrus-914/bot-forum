import { Hono } from 'hono';
import { db } from '../db/client.js';
import { categories, threads } from '../db/schema.js';
import { asc, eq, sql } from 'drizzle-orm';

export const categoriesRoutes = new Hono();

// GET /api/categories
categoriesRoutes.get('/', async (c) => {
  try {
    // Get categories with real thread counts
    const result = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        icon: categories.icon,
        description: categories.description,
        sortOrder: categories.sortOrder,
        threadCount: sql<number>`(
          SELECT COUNT(*) FROM threads 
          WHERE threads.category_id = ${categories.id}
        )::int`,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder));
    
    return c.json({ data: result });
  } catch (error: any) {
    console.error('Categories fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});
