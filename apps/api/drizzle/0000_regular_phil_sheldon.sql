CREATE TABLE IF NOT EXISTS "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"target_type" varchar(50),
	"target_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb,
	"model_used" varchar(100),
	"tokens_used" integer,
	"execution_time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "admin_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0,
	"thread_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debate_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debate_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"persona_1_post_id" uuid,
	"persona_2_post_id" uuid,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(500) NOT NULL,
	"slug" varchar(350) NOT NULL,
	"description" text,
	"thread_id" uuid,
	"category_id" uuid,
	"team_1_id" uuid,
	"persona_1_id" uuid NOT NULL,
	"persona_1_stance" varchar(10) DEFAULT 'pro',
	"persona_1_votes" integer DEFAULT 0,
	"team_2_id" uuid,
	"persona_2_id" uuid NOT NULL,
	"persona_2_stance" varchar(10) DEFAULT 'con',
	"persona_2_votes" integer DEFAULT 0,
	"winner_id" uuid,
	"winner_team_id" uuid,
	"total_rounds" integer DEFAULT 3,
	"current_round" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'pending',
	"admin_summary" text,
	"admin_summary_post_id" uuid,
	"persona_1_final_score" real,
	"persona_2_final_score" real,
	"persona_1_scores" jsonb DEFAULT '{}'::jsonb,
	"persona_2_scores" jsonb DEFAULT '{}'::jsonb,
	"elo_change" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	CONSTRAINT "debates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"mentioned_persona_id" uuid NOT NULL,
	"mentioned_by_persona_id" uuid NOT NULL,
	"context" text,
	"status" varchar(20) DEFAULT 'pending',
	"responded_post_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persona_prediction_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"persona_id" uuid NOT NULL,
	"total_predictions" integer DEFAULT 0,
	"correct_predictions" integer DEFAULT 0,
	"incorrect_predictions" integer DEFAULT 0,
	"pending_predictions" integer DEFAULT 0,
	"accuracy_rate" real DEFAULT 0,
	"avg_confidence" real DEFAULT 50,
	"avg_confidence_when_correct" real DEFAULT 0,
	"avg_confidence_when_wrong" real DEFAULT 0,
	"prediction_points" integer DEFAULT 0,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"current_streak_type" varchar(10),
	"category_stats" jsonb DEFAULT '{}'::jsonb,
	"best_category" varchar(50),
	"worst_category" varchar(50),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "persona_prediction_stats_persona_id_unique" UNIQUE("persona_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"avatar_url" text,
	"description" text,
	"personality_prompt" text NOT NULL,
	"primary_specialization" varchar(50),
	"secondary_specializations" text[] DEFAULT '{}',
	"model_provider" varchar(50) DEFAULT 'openrouter',
	"model_name" varchar(100) DEFAULT 'meta-llama/llama-3.1-70b-instruct',
	"temperature" integer DEFAULT 70,
	"max_tokens" integer DEFAULT 800,
	"is_system" boolean DEFAULT true,
	"elo_rating" integer DEFAULT 1200,
	"total_posts" integer DEFAULT 0,
	"total_upvotes" integer DEFAULT 0,
	"total_downvotes" integer DEFAULT 0,
	"debates_won" integer DEFAULT 0,
	"debates_lost" integer DEFAULT 0,
	"debates_drawn" integer DEFAULT 0,
	"avg_debate_score" real DEFAULT 0,
	"best_debate_score" real DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "personas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"parent_post_id" uuid,
	"content" text NOT NULL,
	"upvotes" integer DEFAULT 0,
	"downvotes" integer DEFAULT 0,
	"is_best_answer" boolean DEFAULT false,
	"is_admin_post" boolean DEFAULT false,
	"mentioned_persona_id" uuid,
	"generation_meta" jsonb DEFAULT '{}'::jsonb,
	"admin_score" integer,
	"admin_comment" text,
	"admin_warning" text,
	"evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prediction_bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prediction_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"team_id" uuid,
	"stance" varchar(10) NOT NULL,
	"confidence" integer NOT NULL,
	"reasoning" text,
	"post_id" uuid,
	"was_correct" boolean,
	"points_earned" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(300) NOT NULL,
	"slug" varchar(350) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"source_url" text,
	"source_text" text,
	"thread_id" uuid,
	"deadline" timestamp with time zone NOT NULL,
	"resolution_date" timestamp with time zone,
	"status" varchar(20) DEFAULT 'open',
	"outcome" varchar(20),
	"outcome_details" text,
	"outcome_source" text,
	"resolved_at" timestamp with time zone,
	"resolved_by_admin" boolean DEFAULT false,
	"admin_resolution_post_id" uuid,
	"total_bets" integer DEFAULT 0,
	"yes_count" integer DEFAULT 0,
	"no_count" integer DEFAULT 0,
	"avg_confidence" real DEFAULT 50,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "predictions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"model_provider" varchar(50) NOT NULL,
	"primary_model" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#6366f1',
	"logo_url" text,
	"total_posts" integer DEFAULT 0,
	"total_debates" integer DEFAULT 0,
	"debates_won" integer DEFAULT 0,
	"debates_lost" integer DEFAULT 0,
	"avg_elo" integer DEFAULT 1200,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(300) NOT NULL,
	"slug" varchar(350) NOT NULL,
	"summary" text,
	"category_id" uuid NOT NULL,
	"starter_persona_id" uuid NOT NULL,
	"post_count" integer DEFAULT 0,
	"upvotes" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"is_debate" boolean DEFAULT false,
	"debate_id" uuid,
	"is_pinned" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_activity_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "threads_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "used_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"title_hash" varchar(64) NOT NULL,
	"source" varchar(50),
	"source_url" text,
	"category" varchar(50),
	"used_for" varchar(20) NOT NULL,
	"thread_id" uuid,
	"debate_id" uuid,
	"prediction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" varchar(100) NOT NULL,
	"visitor_ip" varchar(50),
	"votable_type" varchar(20) NOT NULL,
	"votable_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"voted_persona_id" uuid,
	"voted_team_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"week_end" timestamp with time zone NOT NULL,
	"total_posts" integer DEFAULT 0,
	"total_threads" integer DEFAULT 0,
	"total_debates" integer DEFAULT 0,
	"total_predictions" integer DEFAULT 0,
	"predictions_resolved" integer DEFAULT 0,
	"mvp_persona_id" uuid,
	"mvp_reason" text,
	"top_team_id" uuid,
	"best_debate_id" uuid,
	"best_prediction_id" uuid,
	"hot_streak_persona_id" uuid,
	"hot_streak_count" integer,
	"summary_post_id" uuid,
	"summary_content" text,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debate_rounds" ADD CONSTRAINT "debate_rounds_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debate_rounds" ADD CONSTRAINT "debate_rounds_persona_1_post_id_posts_id_fk" FOREIGN KEY ("persona_1_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debate_rounds" ADD CONSTRAINT "debate_rounds_persona_2_post_id_posts_id_fk" FOREIGN KEY ("persona_2_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_team_1_id_teams_id_fk" FOREIGN KEY ("team_1_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_persona_1_id_personas_id_fk" FOREIGN KEY ("persona_1_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_team_2_id_teams_id_fk" FOREIGN KEY ("team_2_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_persona_2_id_personas_id_fk" FOREIGN KEY ("persona_2_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_winner_id_personas_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_winner_team_id_teams_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debates" ADD CONSTRAINT "debates_admin_summary_post_id_posts_id_fk" FOREIGN KEY ("admin_summary_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_mentions" ADD CONSTRAINT "pending_mentions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_mentions" ADD CONSTRAINT "pending_mentions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_mentions" ADD CONSTRAINT "pending_mentions_mentioned_persona_id_personas_id_fk" FOREIGN KEY ("mentioned_persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_mentions" ADD CONSTRAINT "pending_mentions_mentioned_by_persona_id_personas_id_fk" FOREIGN KEY ("mentioned_by_persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pending_mentions" ADD CONSTRAINT "pending_mentions_responded_post_id_posts_id_fk" FOREIGN KEY ("responded_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "persona_prediction_stats" ADD CONSTRAINT "persona_prediction_stats_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "personas" ADD CONSTRAINT "personas_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_mentioned_persona_id_personas_id_fk" FOREIGN KEY ("mentioned_persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prediction_bets" ADD CONSTRAINT "prediction_bets_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prediction_bets" ADD CONSTRAINT "prediction_bets_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prediction_bets" ADD CONSTRAINT "prediction_bets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prediction_bets" ADD CONSTRAINT "prediction_bets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictions" ADD CONSTRAINT "predictions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictions" ADD CONSTRAINT "predictions_admin_resolution_post_id_posts_id_fk" FOREIGN KEY ("admin_resolution_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "threads" ADD CONSTRAINT "threads_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "threads" ADD CONSTRAINT "threads_starter_persona_id_personas_id_fk" FOREIGN KEY ("starter_persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "used_topics" ADD CONSTRAINT "used_topics_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "used_topics" ADD CONSTRAINT "used_topics_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "used_topics" ADD CONSTRAINT "used_topics_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "votes" ADD CONSTRAINT "votes_voted_persona_id_personas_id_fk" FOREIGN KEY ("voted_persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "votes" ADD CONSTRAINT "votes_voted_team_id_teams_id_fk" FOREIGN KEY ("voted_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_mvp_persona_id_personas_id_fk" FOREIGN KEY ("mvp_persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_top_team_id_teams_id_fk" FOREIGN KEY ("top_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_best_debate_id_debates_id_fk" FOREIGN KEY ("best_debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_best_prediction_id_predictions_id_fk" FOREIGN KEY ("best_prediction_id") REFERENCES "public"."predictions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_hot_streak_persona_id_personas_id_fk" FOREIGN KEY ("hot_streak_persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_summary_post_id_posts_id_fk" FOREIGN KEY ("summary_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "debates_slug_idx" ON "debates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debates_status_idx" ON "debates" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debates_created_idx" ON "debates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mentions_pending_idx" ON "pending_mentions" USING btree ("status","mentioned_persona_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "personas_slug_idx" ON "personas" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personas_elo_idx" ON "personas" USING btree ("elo_rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personas_team_idx" ON "personas" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personas_spec_idx" ON "personas" USING btree ("primary_specialization");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_thread_idx" ON "posts" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_persona_idx" ON "posts" USING btree ("persona_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_created_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bets_prediction_idx" ON "prediction_bets" USING btree ("prediction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bets_persona_idx" ON "prediction_bets" USING btree ("persona_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bets_unique_idx" ON "prediction_bets" USING btree ("prediction_id","persona_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "predictions_slug_idx" ON "predictions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_status_idx" ON "predictions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_deadline_idx" ON "predictions" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_category_idx" ON "predictions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teams_slug_idx" ON "teams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "threads_slug_idx" ON "threads" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "threads_category_idx" ON "threads" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "threads_activity_idx" ON "threads" USING btree ("last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "topics_hash_idx" ON "used_topics" USING btree ("title_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topics_category_idx" ON "used_topics" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "votes_unique_idx" ON "votes" USING btree ("visitor_id","votable_type","votable_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "votes_votable_idx" ON "votes" USING btree ("votable_type","votable_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "summaries_week_idx" ON "weekly_summaries" USING btree ("week_start");