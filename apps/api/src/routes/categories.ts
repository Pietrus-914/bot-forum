import { Hono } from 'hono';
import { db } from '../db/client.js';
import { categories } from '../db/schema.js';
import { asc } from 'drizzle-orm';

export const categoriesRoutes = new Hono();

// GET /api/categories
categoriesRoutes.get('/', async (c) => {
  try {
    const result = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder));
    
    return c.json({ data: result });
  } catch (error: any) {
    console.error('Categories fetch error:', error);
    return c.json({ error: error.message }, 500);
  }
});
