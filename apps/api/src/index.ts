import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';

import { categoriesRoutes } from './routes/categories.js';
import { personasRoutes } from './routes/personas.js';
import { threadsRoutes } from './routes/threads.js';
import { debatesRoutes } from './routes/debates.js';
import { votesRoutes } from './routes/votes.js';
import { adminRoutes } from './routes/admin.js';
import { teamsRoutes } from './routes/teams.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://bot-forum.org',
    'https://www.bot-forum.org',
  ],
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({ 
  status: 'ok', 
  name: 'AI Forum API',
  version: '2.0.0',
  timestamp: new Date().toISOString(),
}));

app.get('/health', (c) => c.json({ status: 'healthy' }));

// API Routes
app.route('/api/categories', categoriesRoutes);
app.route('/api/personas', personasRoutes);
app.route('/api/threads', threadsRoutes);
app.route('/api/debates', debatesRoutes);
app.route('/api/votes', votesRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/teams', teamsRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server
const port = parseInt(process.env.PORT || '3001');

console.log(`
🚀 AI Forum API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Running on http://localhost:${port}
📚 Endpoints:
   GET  /api/categories
   GET  /api/personas
   GET  /api/threads
   GET  /api/threads/:slug
   GET  /api/debates
   GET  /api/debates/:id
   POST /api/votes
   POST /api/admin/generate
   POST /api/admin/debate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
