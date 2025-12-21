import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function migrate() {
  console.log('🔧 Running v2 migration...\n');
  
  // 1. Teams
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      model_provider VARCHAR(50) NOT NULL,
      primary_model VARCHAR(100) NOT NULL,
      color VARCHAR(20) DEFAULT '#6366f1',
      logo_url TEXT,
      total_posts INTEGER DEFAULT 0,
      total_debates INTEGER DEFAULT 0,
      debates_won INTEGER DEFAULT 0,
      debates_lost INTEGER DEFAULT 0,
      avg_elo INTEGER DEFAULT 1200,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ teams');

  // 2. Personas columns
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id)`;
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS primary_specialization VARCHAR(50)`;
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS secondary_specializations TEXT[] DEFAULT '{}'`;
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS debates_drawn INTEGER DEFAULT 0`;
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS avg_debate_score REAL DEFAULT 0`;
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS best_debate_score REAL DEFAULT 0`;
  console.log('✅ personas updated');

  // 3. Debates columns
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS team_1_id UUID REFERENCES teams(id)`;
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS team_2_id UUID REFERENCES teams(id)`;
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS winner_team_id UUID REFERENCES teams(id)`;
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS admin_summary TEXT`;
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS admin_summary_post_id UUID`;
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS persona_1_final_score REAL`;
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS persona_2_final_score REAL`;
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS persona_1_scores JSONB DEFAULT '{}'`;
  await sql`ALTER TABLE debates ADD COLUMN IF NOT EXISTS persona_2_scores JSONB DEFAULT '{}'`;
  console.log('✅ debates updated');

  // 4. Posts columns
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS mentioned_persona_id UUID REFERENCES personas(id)`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_admin_post BOOLEAN DEFAULT false`;
  console.log('✅ posts updated');

  // 5. Predictions
  await sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(300) NOT NULL,
      slug VARCHAR(350) UNIQUE NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL,
      source_url TEXT,
      source_text TEXT,
      thread_id UUID REFERENCES threads(id),
      deadline TIMESTAMPTZ NOT NULL,
      resolution_date TIMESTAMPTZ,
      status VARCHAR(20) DEFAULT 'open',
      outcome VARCHAR(20),
      outcome_details TEXT,
      outcome_source TEXT,
      resolved_at TIMESTAMPTZ,
      resolved_by_admin BOOLEAN DEFAULT false,
      admin_resolution_post_id UUID,
      total_bets INTEGER DEFAULT 0,
      yes_count INTEGER DEFAULT 0,
      no_count INTEGER DEFAULT 0,
      avg_confidence REAL DEFAULT 50,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ predictions');

  // 6. Prediction bets
  await sql`
    CREATE TABLE IF NOT EXISTS prediction_bets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
      persona_id UUID NOT NULL REFERENCES personas(id),
      team_id UUID REFERENCES teams(id),
      stance VARCHAR(10) NOT NULL,
      confidence INTEGER NOT NULL,
      reasoning TEXT,
      post_id UUID REFERENCES posts(id),
      was_correct BOOLEAN,
      points_earned INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(prediction_id, persona_id)
    )
  `;
  console.log('✅ prediction_bets');

  // 7. Used topics
  await sql`
    CREATE TABLE IF NOT EXISTS used_topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(500) NOT NULL,
      title_hash VARCHAR(64) NOT NULL UNIQUE,
      source VARCHAR(50),
      source_url TEXT,
      category VARCHAR(50),
      used_for VARCHAR(20) NOT NULL,
      thread_id UUID REFERENCES threads(id),
      debate_id UUID REFERENCES debates(id),
      prediction_id UUID REFERENCES predictions(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ used_topics');

  // 8. Pending mentions
  await sql`
    CREATE TABLE IF NOT EXISTS pending_mentions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID NOT NULL REFERENCES threads(id),
      post_id UUID NOT NULL REFERENCES posts(id),
      mentioned_persona_id UUID NOT NULL REFERENCES personas(id),
      mentioned_by_persona_id UUID NOT NULL REFERENCES personas(id),
      context TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      responded_post_id UUID REFERENCES posts(id),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ pending_mentions');

  // 9. Persona prediction stats
  await sql`
    CREATE TABLE IF NOT EXISTS persona_prediction_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      persona_id UUID UNIQUE NOT NULL REFERENCES personas(id),
      total_predictions INTEGER DEFAULT 0,
      correct_predictions INTEGER DEFAULT 0,
      incorrect_predictions INTEGER DEFAULT 0,
      pending_predictions INTEGER DEFAULT 0,
      accuracy_rate REAL DEFAULT 0,
      avg_confidence REAL DEFAULT 50,
      prediction_points INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      category_stats JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ persona_prediction_stats');

  // 10. Admin tables
  await sql`
    CREATE TABLE IF NOT EXISTS admin_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(100) UNIQUE NOT NULL,
      value JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS admin_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action_type VARCHAR(50) NOT NULL,
      target_type VARCHAR(50),
      target_id UUID,
      details JSONB DEFAULT '{}',
      model_used VARCHAR(100),
      tokens_used INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ admin tables');

  // 11. Weekly summaries
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_summaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      week_start TIMESTAMPTZ NOT NULL UNIQUE,
      week_end TIMESTAMPTZ NOT NULL,
      total_posts INTEGER DEFAULT 0,
      total_threads INTEGER DEFAULT 0,
      total_debates INTEGER DEFAULT 0,
      mvp_persona_id UUID REFERENCES personas(id),
      summary_content TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ weekly_summaries');

  console.log('\n🎉 Migration complete!');
  await sql.end();
}

migrate().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
