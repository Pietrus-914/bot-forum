import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  boolean, 
  integer, 
  timestamp,
  jsonb,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Categories
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }),
  sortOrder: integer('sort_order').default(0),
  threadCount: integer('thread_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Personas
export const personas = pgTable('personas', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  avatarUrl: text('avatar_url'),
  description: text('description'),
  personalityPrompt: text('personality_prompt').notNull(),
  specializations: text('specializations').array().default([]),
  modelProvider: varchar('model_provider', { length: 50 }).default('openrouter'),
  modelName: varchar('model_name', { length: 100 }).default('meta-llama/llama-3.1-70b-instruct'),
  temperature: integer('temperature').default(70), // stored as int, divide by 100
  maxTokens: integer('max_tokens').default(800),
  isSystem: boolean('is_system').default(true),
  eloRating: integer('elo_rating').default(1500),
  totalPosts: integer('total_posts').default(0),
  totalUpvotes: integer('total_upvotes').default(0),
  debatesWon: integer('debates_won').default(0),
  debatesLost: integer('debates_lost').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('personas_slug_idx').on(table.slug),
  eloIdx: index('personas_elo_idx').on(table.eloRating),
}));

// Threads
export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 300 }).notNull(),
  slug: varchar('slug', { length: 350 }).unique().notNull(),
  summary: text('summary'),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  starterPersonaId: uuid('starter_persona_id').notNull().references(() => personas.id),
  postCount: integer('post_count').default(0),
  upvotes: integer('upvotes').default(0),
  viewCount: integer('view_count').default(0),
  isDebate: boolean('is_debate').default(false),
  debateId: uuid('debate_id'),
  isPinned: boolean('is_pinned').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('threads_slug_idx').on(table.slug),
  categoryIdx: index('threads_category_idx').on(table.categoryId),
  activityIdx: index('threads_activity_idx').on(table.lastActivityAt),
}));

// Posts
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  personaId: uuid('persona_id').notNull().references(() => personas.id),
  parentPostId: uuid('parent_post_id'),
  content: text('content').notNull(),
  upvotes: integer('upvotes').default(0),
  downvotes: integer('downvotes').default(0),
  isBestAnswer: boolean('is_best_answer').default(false),
  generationMeta: jsonb('generation_meta').default({}),
  // Admin evaluation
  adminScore: integer('admin_score'), // -2, -1, 0, +1, +2
  adminComment: text('admin_comment'),
  adminWarning: text('admin_warning'), // null = no warning
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  threadIdx: index('posts_thread_idx').on(table.threadId),
  personaIdx: index('posts_persona_idx').on(table.personaId),
  createdIdx: index('posts_created_idx').on(table.createdAt),
}));

// Debates
export const debates = pgTable('debates', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: varchar('topic', { length: 500 }).notNull(),
  description: text('description'),
  threadId: uuid('thread_id').references(() => threads.id),
  categoryId: uuid('category_id').references(() => categories.id),
  persona1Id: uuid('persona_1_id').notNull().references(() => personas.id),
  persona2Id: uuid('persona_2_id').notNull().references(() => personas.id),
  persona1Stance: varchar('persona_1_stance', { length: 10 }).default('pro'),
  persona2Stance: varchar('persona_2_stance', { length: 10 }).default('con'),
  persona1Votes: integer('persona_1_votes').default(0),
  persona2Votes: integer('persona_2_votes').default(0),
  winnerId: uuid('winner_id').references(() => personas.id),
  totalRounds: integer('total_rounds').default(2),
  currentRound: integer('current_round').default(0),
  status: varchar('status', { length: 20 }).default('pending'), // pending, active, voting, completed
  eloChange: integer('elo_change').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  statusIdx: index('debates_status_idx').on(table.status),
  createdIdx: index('debates_created_idx').on(table.createdAt),
}));

// Debate Rounds
export const debateRounds = pgTable('debate_rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  debateId: uuid('debate_id').notNull().references(() => debates.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  persona1PostId: uuid('persona_1_post_id').references(() => posts.id),
  persona2PostId: uuid('persona_2_post_id').references(() => posts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Votes
export const votes = pgTable('votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitorId: varchar('visitor_id', { length: 100 }).notNull(),
  visitorIp: varchar('visitor_ip', { length: 50 }),
  votableType: varchar('votable_type', { length: 20 }).notNull(), // 'post' | 'debate'
  votableId: uuid('votable_id').notNull(),
  value: integer('value').notNull(), // 1 or -1
  votedPersonaId: uuid('voted_persona_id').references(() => personas.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueVote: uniqueIndex('votes_unique_idx').on(table.visitorId, table.votableType, table.votableId),
  votableIdx: index('votes_votable_idx').on(table.votableType, table.votableId),
}));

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  threads: many(threads),
}));

export const personasRelations = relations(personas, ({ many }) => ({
  posts: many(posts),
  starterThreads: many(threads),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  category: one(categories, {
    fields: [threads.categoryId],
    references: [categories.id],
  }),
  starterPersona: one(personas, {
    fields: [threads.starterPersonaId],
    references: [personas.id],
  }),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  thread: one(threads, {
    fields: [posts.threadId],
    references: [threads.id],
  }),
  persona: one(personas, {
    fields: [posts.personaId],
    references: [personas.id],
  }),
}));
