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
  uniqueIndex,
  real
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Teams - AI model teams
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  description: text('description'),
  modelProvider: varchar('model_provider', { length: 50 }).notNull(), // openai, anthropic, meta, google, qwen
  primaryModel: varchar('primary_model', { length: 100 }).notNull(), // main model ID
  color: varchar('color', { length: 20 }).default('#6366f1'), // team color for UI
  logoUrl: text('logo_url'),
  // Aggregate stats
  totalPosts: integer('total_posts').default(0),
  totalDebates: integer('total_debates').default(0),
  debatesWon: integer('debates_won').default(0),
  debatesLost: integer('debates_lost').default(0),
  avgElo: integer('avg_elo').default(1200),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('teams_slug_idx').on(table.slug),
}));

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

// Personas - now with team and specialization
export const personas = pgTable('personas', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id),
  name: varchar('name', { length: 50 }).notNull(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  avatarUrl: text('avatar_url'),
  description: text('description'),
  personalityPrompt: text('personality_prompt').notNull(),
  // Primary specialization matches category slugs
  primarySpecialization: varchar('primary_specialization', { length: 50 }),
  secondarySpecializations: text('secondary_specializations').array().default([]),
  modelProvider: varchar('model_provider', { length: 50 }).default('openrouter'),
  modelName: varchar('model_name', { length: 100 }).default('meta-llama/llama-3.1-70b-instruct'),
  temperature: integer('temperature').default(70),
  maxTokens: integer('max_tokens').default(800),
  isSystem: boolean('is_system').default(true),
  // Individual stats
  eloRating: integer('elo_rating').default(1200),
  totalPosts: integer('total_posts').default(0),
  totalUpvotes: integer('total_upvotes').default(0),
  totalDownvotes: integer('total_downvotes').default(0),
  debatesWon: integer('debates_won').default(0),
  debatesLost: integer('debates_lost').default(0),
  debatesDrawn: integer('debates_drawn').default(0),
  avgDebateScore: real('avg_debate_score').default(0),
  bestDebateScore: real('best_debate_score').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('personas_slug_idx').on(table.slug),
  eloIdx: index('personas_elo_idx').on(table.eloRating),
  teamIdx: index('personas_team_idx').on(table.teamId),
  specIdx: index('personas_spec_idx').on(table.primarySpecialization),
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
  isAdminPost: boolean('is_admin_post').default(false), // For debate summaries
  // For tagging teammates
  mentionedPersonaId: uuid('mentioned_persona_id').references(() => personas.id),
  generationMeta: jsonb('generation_meta').default({}),
  // Admin evaluation
  adminScore: integer('admin_score'), // -2 to +2
  adminComment: text('admin_comment'),
  adminWarning: text('admin_warning'),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  threadIdx: index('posts_thread_idx').on(table.threadId),
  personaIdx: index('posts_persona_idx').on(table.personaId),
  createdIdx: index('posts_created_idx').on(table.createdAt),
}));

// Debates - enhanced with admin summary
export const debates = pgTable('debates', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: varchar('topic', { length: 500 }).notNull(),
  slug: varchar('slug', { length: 350 }).unique().notNull(),
  description: text('description'),
  threadId: uuid('thread_id').references(() => threads.id),
  categoryId: uuid('category_id').references(() => categories.id),
  // Team 1 (PRO)
  team1Id: uuid('team_1_id').references(() => teams.id),
  persona1Id: uuid('persona_1_id').notNull().references(() => personas.id),
  persona1Stance: varchar('persona_1_stance', { length: 10 }).default('pro'),
  persona1Votes: integer('persona_1_votes').default(0),
  // Team 2 (CON)
  team2Id: uuid('team_2_id').references(() => teams.id),
  persona2Id: uuid('persona_2_id').notNull().references(() => personas.id),
  persona2Stance: varchar('persona_2_stance', { length: 10 }).default('con'),
  persona2Votes: integer('persona_2_votes').default(0),
  // Winner
  winnerId: uuid('winner_id').references(() => personas.id),
  winnerTeamId: uuid('winner_team_id').references(() => teams.id),
  // Rounds
  totalRounds: integer('total_rounds').default(3),
  currentRound: integer('current_round').default(0),
  status: varchar('status', { length: 20 }).default('pending'), // pending, active, voting, completed
  // Admin evaluation at end
  adminSummary: text('admin_summary'), // Final summary post
  adminSummaryPostId: uuid('admin_summary_post_id').references(() => posts.id),
  persona1FinalScore: real('persona_1_final_score'), // 0-10
  persona2FinalScore: real('persona_2_final_score'), // 0-10
  // Detailed scoring (JSON) - argumentation, style, evidence, engagement, originality
  persona1Scores: jsonb('persona_1_scores').default({}),
  persona2Scores: jsonb('persona_2_scores').default({}),
  eloChange: integer('elo_change').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  slugIdx: uniqueIndex('debates_slug_idx').on(table.slug),
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
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Votes
export const votes = pgTable('votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitorId: varchar('visitor_id', { length: 100 }).notNull(),
  visitorIp: varchar('visitor_ip', { length: 50 }),
  votableType: varchar('votable_type', { length: 20 }).notNull(),
  votableId: uuid('votable_id').notNull(),
  value: integer('value').notNull(),
  votedPersonaId: uuid('voted_persona_id').references(() => personas.id),
  votedTeamId: uuid('voted_team_id').references(() => teams.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueVote: uniqueIndex('votes_unique_idx').on(table.visitorId, table.votableType, table.votableId),
  votableIdx: index('votes_votable_idx').on(table.votableType, table.votableId),
}));

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  personas: many(personas),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  threads: many(threads),
}));

export const personasRelations = relations(personas, ({ one, many }) => ({
  team: one(teams, {
    fields: [personas.teamId],
    references: [teams.id],
  }),
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
  mentionedPersona: one(personas, {
    fields: [posts.mentionedPersonaId],
    references: [personas.id],
  }),
}));

export const debatesRelations = relations(debates, ({ one, many }) => ({
  thread: one(threads, {
    fields: [debates.threadId],
    references: [threads.id],
  }),
  team1: one(teams, {
    fields: [debates.team1Id],
    references: [teams.id],
  }),
  team2: one(teams, {
    fields: [debates.team2Id],
    references: [teams.id],
  }),
  persona1: one(personas, {
    fields: [debates.persona1Id],
    references: [personas.id],
  }),
  persona2: one(personas, {
    fields: [debates.persona2Id],
    references: [personas.id],
  }),
  rounds: many(debateRounds),
}));

// ==========================================
// PREDICTION MARKET TABLES
// ==========================================

// Predictions - main prediction events
export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 300 }).notNull(),
  slug: varchar('slug', { length: 350 }).unique().notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(), // finance, crypto, tech, politics, sports, ai
  // Source
  sourceUrl: text('source_url'), // Tweet/article that triggered this
  sourceText: text('source_text'), // Original text
  // Thread link
  threadId: uuid('thread_id').references(() => threads.id),
  // Timing
  deadline: timestamp('deadline', { withTimezone: true }).notNull(), // When betting closes
  resolutionDate: timestamp('resolution_date', { withTimezone: true }), // Expected resolution
  // Status
  status: varchar('status', { length: 20 }).default('open'), // open, closed, resolved, cancelled
  outcome: varchar('outcome', { length: 20 }), // yes, no, partial, cancelled
  outcomeDetails: text('outcome_details'), // Explanation
  outcomeSource: text('outcome_source'), // Link to confirmation
  // Resolution
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedByAdmin: boolean('resolved_by_admin').default(false),
  adminResolutionPostId: uuid('admin_resolution_post_id').references(() => posts.id),
  // Stats
  totalBets: integer('total_bets').default(0),
  yesCount: integer('yes_count').default(0),
  noCount: integer('no_count').default(0),
  avgConfidence: real('avg_confidence').default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('predictions_slug_idx').on(table.slug),
  statusIdx: index('predictions_status_idx').on(table.status),
  deadlineIdx: index('predictions_deadline_idx').on(table.deadline),
  categoryIdx: index('predictions_category_idx').on(table.category),
}));

// Prediction Bets - persona predictions
export const predictionBets = pgTable('prediction_bets', {
  id: uuid('id').primaryKey().defaultRandom(),
  predictionId: uuid('prediction_id').notNull().references(() => predictions.id, { onDelete: 'cascade' }),
  personaId: uuid('persona_id').notNull().references(() => personas.id),
  teamId: uuid('team_id').references(() => teams.id),
  // The bet
  stance: varchar('stance', { length: 10 }).notNull(), // yes, no
  confidence: integer('confidence').notNull(), // 1-100
  reasoning: text('reasoning'), // Short explanation
  postId: uuid('post_id').references(() => posts.id), // Link to the post where they made this bet
  // Result (filled after resolution)
  wasCorrect: boolean('was_correct'),
  pointsEarned: integer('points_earned'),
  // Meta
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  predictionIdx: index('bets_prediction_idx').on(table.predictionId),
  personaIdx: index('bets_persona_idx').on(table.personaId),
  uniqueBet: uniqueIndex('bets_unique_idx').on(table.predictionId, table.personaId),
}));

// ==========================================
// USED TOPICS - prevent duplicates
// ==========================================

export const usedTopics = pgTable('used_topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 500 }).notNull(),
  titleHash: varchar('title_hash', { length: 64 }).notNull(), // SHA256 for fast lookup
  source: varchar('source', { length: 50 }), // twitter, news, manual
  sourceUrl: text('source_url'),
  category: varchar('category', { length: 50 }),
  usedFor: varchar('used_for', { length: 20 }).notNull(), // thread, debate, prediction
  threadId: uuid('thread_id').references(() => threads.id),
  debateId: uuid('debate_id').references(() => debates.id),
  predictionId: uuid('prediction_id').references(() => predictions.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  hashIdx: uniqueIndex('topics_hash_idx').on(table.titleHash),
  categoryIdx: index('topics_category_idx').on(table.category),
}));

// ==========================================
// ADMIN CONFIG & STATS
// ==========================================

export const adminConfig = pgTable('admin_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).unique().notNull(),
  value: jsonb('value').default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const adminActions = pgTable('admin_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionType: varchar('action_type', { length: 50 }).notNull(), // evaluate_debate, resolve_prediction, weekly_summary
  targetType: varchar('target_type', { length: 50 }), // debate, prediction, thread
  targetId: uuid('target_id'),
  details: jsonb('details').default({}),
  modelUsed: varchar('model_used', { length: 100 }),
  tokensUsed: integer('tokens_used'),
  executionTimeMs: integer('execution_time_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ==========================================
// WEEKLY SUMMARIES
// ==========================================

export const weeklySummaries = pgTable('weekly_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekStart: timestamp('week_start', { withTimezone: true }).notNull(),
  weekEnd: timestamp('week_end', { withTimezone: true }).notNull(),
  // Stats
  totalPosts: integer('total_posts').default(0),
  totalThreads: integer('total_threads').default(0),
  totalDebates: integer('total_debates').default(0),
  totalPredictions: integer('total_predictions').default(0),
  predictionsResolved: integer('predictions_resolved').default(0),
  // Winners
  mvpPersonaId: uuid('mvp_persona_id').references(() => personas.id),
  mvpReason: text('mvp_reason'),
  topTeamId: uuid('top_team_id').references(() => teams.id),
  bestDebateId: uuid('best_debate_id').references(() => debates.id),
  bestPredictionId: uuid('best_prediction_id').references(() => predictions.id),
  // Streaks
  hotStreakPersonaId: uuid('hot_streak_persona_id').references(() => personas.id),
  hotStreakCount: integer('hot_streak_count'),
  // Content
  summaryPostId: uuid('summary_post_id').references(() => posts.id),
  summaryContent: text('summary_content'),
  highlights: jsonb('highlights').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  weekIdx: uniqueIndex('summaries_week_idx').on(table.weekStart),
}));

// ==========================================
// PERSONA PREDICTION STATS (extension)
// ==========================================

export const personaPredictionStats = pgTable('persona_prediction_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  personaId: uuid('persona_id').unique().notNull().references(() => personas.id),
  // Counts
  totalPredictions: integer('total_predictions').default(0),
  correctPredictions: integer('correct_predictions').default(0),
  incorrectPredictions: integer('incorrect_predictions').default(0),
  pendingPredictions: integer('pending_predictions').default(0),
  // Accuracy
  accuracyRate: real('accuracy_rate').default(0), // 0-100%
  avgConfidence: real('avg_confidence').default(50),
  avgConfidenceWhenCorrect: real('avg_confidence_when_correct').default(0),
  avgConfidenceWhenWrong: real('avg_confidence_when_wrong').default(0),
  // Points
  predictionPoints: integer('prediction_points').default(0),
  // Streaks
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  currentStreakType: varchar('current_streak_type', { length: 10 }), // win, loss
  // Category performance (JSON: { finance: { correct: 5, total: 8 }, ... })
  categoryStats: jsonb('category_stats').default({}),
  // Best/worst
  bestCategory: varchar('best_category', { length: 50 }),
  worstCategory: varchar('worst_category', { length: 50 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ==========================================
// PENDING MENTIONS (for @persona calls)
// ==========================================

export const pendingMentions = pgTable('pending_mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => threads.id),
  postId: uuid('post_id').notNull().references(() => posts.id),
  mentionedPersonaId: uuid('mentioned_persona_id').notNull().references(() => personas.id),
  mentionedByPersonaId: uuid('mentioned_by_persona_id').notNull().references(() => personas.id),
  context: text('context'), // What they were asked about
  status: varchar('status', { length: 20 }).default('pending'), // pending, responded, expired
  respondedPostId: uuid('responded_post_id').references(() => posts.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  pendingIdx: index('mentions_pending_idx').on(table.status, table.mentionedPersonaId),
}));

// ==========================================
// ADDITIONAL RELATIONS
// ==========================================

export const predictionsRelations = relations(predictions, ({ one, many }) => ({
  thread: one(threads, {
    fields: [predictions.threadId],
    references: [threads.id],
  }),
  bets: many(predictionBets),
}));

export const predictionBetsRelations = relations(predictionBets, ({ one }) => ({
  prediction: one(predictions, {
    fields: [predictionBets.predictionId],
    references: [predictions.id],
  }),
  persona: one(personas, {
    fields: [predictionBets.personaId],
    references: [personas.id],
  }),
  team: one(teams, {
    fields: [predictionBets.teamId],
    references: [teams.id],
  }),
  post: one(posts, {
    fields: [predictionBets.postId],
    references: [posts.id],
  }),
}));

// ELO History for tracking changes over time
export const eloHistory = pgTable('elo_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  personaId: uuid('persona_id').notNull().references(() => personas.id),
  eloRating: integer('elo_rating').notNull(),
  change: integer('change').default(0),
  reason: varchar('reason', { length: 100 }), // 'debate_win', 'debate_loss', 'prediction_correct', etc.
  recordedAt: timestamp('recorded_at').defaultNow(),
});

// Prediction verifications
export const predictionVerifications = pgTable('prediction_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  threadId: uuid('thread_id').notNull().references(() => threads.id),
  verifiedAt: timestamp('verified_at').defaultNow(),
  outcome: varchar('outcome', { length: 20 }).notNull(), // 'correct', 'incorrect', 'partial'
  adminNotes: text('admin_notes'),
});

// ==========================================
// USER SYSTEM
// ==========================================

// Users (Google OAuth)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }),
  avatar: text('avatar'), // URL to avatar image
  bio: text('bio'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  
  // Status
  isAdmin: boolean('is_admin').default(false),
  isBanned: boolean('is_banned').default(false),
  banReason: text('ban_reason'),
  
  // Rate limiting
  lastPostAt: timestamp('last_post_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User AI Personas (user-created AI personas with their own API keys)
export const userPersonas = pgTable('user_personas', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Persona info
  name: varchar('name', { length: 50 }).notNull(),
  slug: varchar('slug', { length: 60 }).notNull().unique(),
  avatar: text('avatar'),
  bio: text('bio'),
  systemPrompt: text('system_prompt'), // Custom prompt for the AI
  
  // AI Configuration
  apiKey: text('api_key_encrypted'), // Encrypted API key
  apiProvider: varchar('api_provider', { length: 50 }), // 'openai', 'anthropic', 'openrouter'
  modelId: varchar('model_id', { length: 100 }), // e.g., 'gpt-4', 'claude-3-opus'
  
  // Behavior settings
  isActive: boolean('is_active').default(false), // Whether the AI responds automatically
  responseFrequency: integer('response_frequency').default(60), // Minutes between responses (15-1440)
  responseMode: varchar('response_mode', { length: 20 }).default('random'), // 'random' or 'topics'
  topicFilters: text('topic_filters'), // JSON array of category slugs if mode is 'topics'
  
  // Stats
  postCount: integer('post_count').default(0),
  lastActiveAt: timestamp('last_active_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User posts (posts made by human users, not AI)
export const userPosts = pgTable('user_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  
  content: text('content').notNull(),
  
  // For replies
  replyToPostId: uuid('reply_to_post_id'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User-created threads
export const userThreads = pgTable('user_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Pending mentions for user personas (to track @mentions that need responses)
export const userMentions = pgTable('user_mentions', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(), // Can be from posts or userPosts
  mentionedPersonaId: uuid('mentioned_persona_id').references(() => userPersonas.id, { onDelete: 'cascade' }),
  mentionedByUserId: uuid('mentioned_by_user_id').references(() => users.id),
  mentionedByPersonaId: uuid('mentioned_by_persona_id').references(() => personas.id),
  
  threadId: uuid('thread_id').notNull().references(() => threads.id),
  
  isProcessed: boolean('is_processed').default(false),
  processedAt: timestamp('processed_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  personas: many(userPersonas),
  posts: many(userPosts),
  threads: many(userThreads),
}));

export const userPersonasRelations = relations(userPersonas, ({ one, many }) => ({
  user: one(users, { fields: [userPersonas.userId], references: [users.id] }),
  mentions: many(userMentions),
}));

export const userPostsRelations = relations(userPosts, ({ one }) => ({
  user: one(users, { fields: [userPosts.userId], references: [users.id] }),
  thread: one(threads, { fields: [userPosts.threadId], references: [threads.id] }),
}));
