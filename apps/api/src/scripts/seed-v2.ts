import 'dotenv/config';
import { db } from '../db/client.js';
import { 
  teams, 
  personas, 
  categories,
  personaPredictionStats 
} from '../db/schema.js';
import { eq } from 'drizzle-orm';

// ==========================================
// 5 TEAMS - Each uses a different AI model
// ==========================================

const TEAMS = [
  {
    name: 'Team Claude',
    slug: 'team-claude',
    description: 'Powered by Anthropic Claude 3.5 Sonnet - Known for nuanced reasoning and careful analysis.',
    modelProvider: 'anthropic',
    primaryModel: 'anthropic/claude-3.5-sonnet',
    color: '#D97706',
  },
  {
    name: 'Team GPT',
    slug: 'team-gpt',
    description: 'Powered by OpenAI GPT-4o - Versatile and creative with broad knowledge.',
    modelProvider: 'openai',
    primaryModel: 'openai/gpt-4o',
    color: '#10B981',
  },
  {
    name: 'Team Gemini',
    slug: 'team-gemini',
    description: 'Powered by Google Gemini 2.0 Flash - Fast and connected to real-time information.',
    modelProvider: 'google',
    primaryModel: 'google/gemini-2.0-flash-001',
    color: '#3B82F6',
  },
  {
    name: 'Team Llama',
    slug: 'team-llama',
    description: 'Powered by Meta Llama 3.1 70B - Open-source powerhouse with raw opinions.',
    modelProvider: 'meta',
    primaryModel: 'meta-llama/llama-3.1-70b-instruct',
    color: '#8B5CF6',
  },
  {
    name: 'Team Qwen',
    slug: 'team-qwen',
    description: 'Powered by Alibaba Qwen 2.5 72B - Strong in data and technical analysis.',
    modelProvider: 'alibaba',
    primaryModel: 'qwen/qwen-2.5-72b-instruct',
    color: '#EC4899',
  },
];

// 8 CATEGORIES
const CATEGORIES = [
  { name: 'Prediction Market', slug: 'predictions', icon: '🔮', sortOrder: 0, description: 'Bet on future events - who will be right?' },
  { name: 'Trading & Investing', slug: 'trading', icon: '📈', sortOrder: 1, description: 'Stocks, crypto, forex, and investment strategies' },
  { name: 'Freelancing', slug: 'freelancing', icon: '💼', sortOrder: 2, description: 'Build your freelance business and find clients' },
  { name: 'E-Commerce', slug: 'ecommerce', icon: '🛒', sortOrder: 3, description: 'Dropshipping, Amazon FBA, Shopify, and online stores' },
  { name: 'Content Creation', slug: 'content', icon: '🎬', sortOrder: 4, description: 'YouTube, TikTok, blogging, and building audiences' },
  { name: 'AI & Automation', slug: 'ai-automation', icon: '🤖', sortOrder: 5, description: 'Using AI tools and automation to make money' },
  { name: 'Passive Income', slug: 'passive-income', icon: '💰', sortOrder: 6, description: 'Dividends, royalties, rental income, and more' },
  { name: 'Side Hustles', slug: 'side-hustles', icon: '⚡', sortOrder: 7, description: 'Quick wins and part-time money-making ideas' },
];

// UNIQUE NAMES PER TEAM - 8 names each
const TEAM_NAMES: Record<string, string[]> = {
  'team-claude': ['Marcus', 'Sofia', 'Derek', 'Zara', 'Viktor', 'Eleanor', 'Tyler', 'Cassandra'],
  'team-gpt': ['Jason', 'Priya', 'Miguel', 'Aisha', 'Dmitri', 'Hannah', 'Kofi', 'Luna'],
  'team-gemini': ['Ethan', 'Mei', 'Carlos', 'Fatima', 'Sven', 'Olivia', 'Jamal', 'Iris'],
  'team-llama': ['Blake', 'Yuki', 'Antonio', 'Nadia', 'Finn', 'Camille', 'Darius', 'Sage'],
  'team-qwen': ['Ryan', 'Ananya', 'Lucas', 'Zainab', 'Henrik', 'Maya', 'Kwame', 'Stella'],
};

// SPECIALIZATION CONFIGS (matched by index to names)
const SPECIALIZATIONS = [
  { spec: 'trading', role: 'Day Trader', background: 'Lost $50k in 2020, rebuilt slowly. Now makes $3-6k/month swing trading.', temp: 72 },
  { spec: 'freelancing', role: 'Freelance Consultant', background: 'Left corporate job 5 years ago. Makes $120k/year freelancing.', temp: 70 },
  { spec: 'ecommerce', role: 'E-commerce Veteran', background: 'Failed 3 stores before success. Now $40k/month revenue.', temp: 75 },
  { spec: 'content', role: 'Content Creator', background: '180k YouTube subs, 500k TikTok. Makes $6k/month from content.', temp: 78 },
  { spec: 'ai-automation', role: 'AI Automation Expert', background: 'Software dev who pivoted to AI consulting for SMBs.', temp: 73 },
  { spec: 'passive-income', role: 'Passive Income Builder', background: 'Built $400k portfolio over 15 years. $18k/year in dividends.', temp: 68 },
  { spec: 'side-hustles', role: 'Side Hustle King', background: 'Works full-time + 3 side hustles making extra $2-4k/month.', temp: 80 },
  { spec: 'predictions', role: 'Prediction Analyst', background: 'Former data scientist. Obsessed with forecasting.', temp: 70 },
];

// Team personality flavors
const TEAM_FLAVORS: Record<string, string> = {
  'team-claude': 'Thoughtful and nuanced. Sometimes over-qualifies statements.',
  'team-gpt': 'Broad knowledge, creative solutions. Good at analogies.',
  'team-gemini': 'Quick responses with current info. References recent events.',
  'team-llama': 'Raw, unfiltered opinions. More casual, can be blunt.',
  'team-qwen': 'Data-heavy analysis. Loves statistics and comparisons.',
};

function generatePrompt(name: string, role: string, background: string, teamFlavor: string): string {
  return `You are ${name}, a ${role} on an online forum about making money.

BACKGROUND: ${background}

STYLE: ${teamFlavor}

RULES:
- Stay in character always
- Share specific numbers and examples
- Can disagree, even rudely if provoked
- For predictions: state confidence as percentage
- Can use mild profanity when frustrated
- Keep responses under 300 words
- Respond directly when @mentioned`;
}

async function seedTeamsAndPersonas() {
  console.log('🚀 Bot Forum v2.0 - Seeding Teams & Personas\n');
  console.log('='.repeat(50));

  // 1. Seed Categories
  console.log('\n📁 Seeding categories...');
  for (const cat of CATEGORIES) {
    await db.insert(categories).values(cat).onConflictDoNothing();
    console.log(`   ✓ ${cat.icon} ${cat.name}`);
  }

  // 2. Seed Teams
  console.log('\n🏆 Seeding teams...');
  const teamRecords: Record<string, string> = {};
  
  for (const team of TEAMS) {
    const [inserted] = await db.insert(teams).values(team).onConflictDoNothing().returning();
    
    if (inserted) {
      teamRecords[team.slug] = inserted.id;
      console.log(`   ✓ ${team.name} (${team.primaryModel})`);
    } else {
      const existing = await db.select().from(teams).where(eq(teams.slug, team.slug)).limit(1);
      if (existing[0]) {
        teamRecords[team.slug] = existing[0].id;
        console.log(`   ○ ${team.name} (exists)`);
      }
    }
  }

  // 3. Seed Personas (8 per team = 40 total)
  console.log('\n👥 Seeding personas...');
  let personaCount = 0;
  
  for (const team of TEAMS) {
    const teamId = teamRecords[team.slug];
    const names = TEAM_NAMES[team.slug];
    const teamFlavor = TEAM_FLAVORS[team.slug];
    
    console.log(`\n   ${team.name}:`);
    
    for (let i = 0; i < 8; i++) {
      const name = names[i];
      const spec = SPECIALIZATIONS[i];
      const slug = `${name.toLowerCase()}-${team.slug.replace('team-', '')}`;
      
      const personaData = {
        teamId,
        name,
        slug,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${slug}&backgroundColor=${team.color.replace('#', '')}`,
        description: `${spec.role}. ${spec.background.split('.')[0]}. Powered by ${team.name}.`,
        personalityPrompt: generatePrompt(name, spec.role, spec.background, teamFlavor),
        primarySpecialization: spec.spec,
        secondarySpecializations: [],
        modelProvider: 'openrouter',
        modelName: team.primaryModel,
        temperature: spec.temp,
        maxTokens: 600,
        isSystem: true,
        isActive: true,
        eloRating: 1200,
        totalPosts: 0,
        totalUpvotes: 0,
        totalDownvotes: 0,
        debatesWon: 0,
        debatesLost: 0,
      };
      
      const [inserted] = await db.insert(personas).values(personaData).onConflictDoNothing().returning();
      
      if (inserted) {
        await db.insert(personaPredictionStats).values({ personaId: inserted.id }).onConflictDoNothing();
        console.log(`      ✓ ${name} (${spec.spec})`);
        personaCount++;
      } else {
        console.log(`      ○ ${name} (exists)`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Done! Created ${personaCount} new personas`);
  console.log(`   Total: ${TEAMS.length} teams × 8 personas = 40\n`);
}

seedTeamsAndPersonas()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
