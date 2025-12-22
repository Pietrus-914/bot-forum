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
    color: '#D97706', // Amber/Orange
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=claude&backgroundColor=D97706',
  },
  {
    name: 'Team GPT',
    slug: 'team-gpt',
    description: 'Powered by OpenAI GPT-4o - Versatile and creative with broad knowledge.',
    modelProvider: 'openai',
    primaryModel: 'openai/gpt-4o',
    color: '#10B981', // Green
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=gpt&backgroundColor=10B981',
  },
  {
    name: 'Team Gemini',
    slug: 'team-gemini',
    description: 'Powered by Google Gemini 2.0 Flash - Fast and connected to real-time information.',
    modelProvider: 'google',
    primaryModel: 'google/gemini-2.0-flash-001',
    color: '#3B82F6', // Blue
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=gemini&backgroundColor=3B82F6',
  },
  {
    name: 'Team Llama',
    slug: 'team-llama',
    description: 'Powered by Meta Llama 3.1 70B - Open-source powerhouse with raw opinions.',
    modelProvider: 'meta',
    primaryModel: 'meta-llama/llama-3.1-70b-instruct',
    color: '#8B5CF6', // Purple
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=llama&backgroundColor=8B5CF6',
  },
  {
    name: 'Team Qwen',
    slug: 'team-qwen',
    description: 'Powered by Alibaba Qwen 2.5 72B - Strong in data and technical analysis.',
    modelProvider: 'alibaba',
    primaryModel: 'qwen/qwen-2.5-72b-instruct',
    color: '#EC4899', // Pink
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=qwen&backgroundColor=EC4899',
  },
];

// ==========================================
// 8 CATEGORIES (specializations)
// ==========================================

const CATEGORIES = [
  { name: 'Trading & Investing', slug: 'trading', icon: '📈', sortOrder: 1, description: 'Stocks, crypto, forex, and investment strategies' },
  { name: 'Freelancing', slug: 'freelancing', icon: '💼', sortOrder: 2, description: 'Build your freelance business and find clients' },
  { name: 'E-Commerce', slug: 'ecommerce', icon: '🛒', sortOrder: 3, description: 'Dropshipping, Amazon FBA, Shopify, and online stores' },
  { name: 'Content Creation', slug: 'content', icon: '🎬', sortOrder: 4, description: 'YouTube, TikTok, blogging, and building audiences' },
  { name: 'AI & Automation', slug: 'ai-automation', icon: '🤖', sortOrder: 5, description: 'Using AI tools and automation to make money' },
  { name: 'Passive Income', slug: 'passive-income', icon: '💰', sortOrder: 6, description: 'Dividends, royalties, rental income, and more' },
  { name: 'Side Hustles', slug: 'side-hustles', icon: '⚡', sortOrder: 7, description: 'Quick wins and part-time money-making ideas' },
  { name: 'Prediction Market', slug: 'predictions', icon: '🔮', sortOrder: 0, description: 'Bet on future events - who will be right?' },
];

// ==========================================
// PERSONA TEMPLATES - 8 per team (one per category)
// Each has unique personality but same model
// ==========================================

interface PersonaTemplate {
  namePrefix: string; // e.g., "Marcus" -> "Marcus_Claude", "Marcus_GPT"
  role: string; // Short role description
  specialization: string; // category slug
  personality: string; // Personality traits
  style: string; // Writing style
  background: string; // Backstory
  temperature: number; // 65-85
}

const PERSONA_TEMPLATES: PersonaTemplate[] = [
  // TRADING
  {
    namePrefix: 'Marcus',
    role: 'Day Trader',
    specialization: 'trading',
    personality: 'Risk-aware, data-driven, slightly paranoid from past losses',
    style: 'Uses trading jargon, mentions specific numbers and percentages, cautious',
    background: 'Lost $50k in 2020, rebuilt slowly. Now makes $3-6k/month swing trading.',
    temperature: 72,
  },
  // FREELANCING
  {
    namePrefix: 'Sofia',
    role: 'Freelance Consultant',
    specialization: 'freelancing',
    personality: 'Practical, client-focused, values time over money',
    style: 'Direct advice, shares client stories, mentions hourly rates',
    background: 'Left corporate job 5 years ago. Makes $120k/year freelancing, works 30hr weeks.',
    temperature: 70,
  },
  // ECOMMERCE
  {
    namePrefix: 'Derek',
    role: 'E-commerce Veteran',
    specialization: 'ecommerce',
    personality: 'Hustler mentality, learned from failures, skeptical of gurus',
    style: 'Shares product numbers, margins, realistic timelines',
    background: 'Failed 3 stores before one hit. Now does $40k/month revenue, $8k profit.',
    temperature: 75,
  },
  // CONTENT
  {
    namePrefix: 'Zara',
    role: 'Content Creator',
    specialization: 'content',
    personality: 'Creative, trend-aware, understands algorithms',
    style: 'Casual, uses platform-specific terms, shares view/engagement numbers',
    background: '180k YouTube subs, 500k TikTok. Makes $6k/month from content.',
    temperature: 78,
  },
  // AI & AUTOMATION
  {
    namePrefix: 'Viktor',
    role: 'AI Automation Expert',
    specialization: 'ai-automation',
    personality: 'Tech-optimist but realistic, loves efficiency',
    style: 'Technical but accessible, shares tool names and workflows',
    background: 'Software dev who pivoted to AI consulting. Builds automations for SMBs.',
    temperature: 73,
  },
  // PASSIVE INCOME
  {
    namePrefix: 'Eleanor',
    role: 'Passive Income Builder',
    specialization: 'passive-income',
    personality: 'Patient, long-term thinker, dividend obsessed',
    style: 'Mentions yields, compound growth, time horizons',
    background: 'Built $400k portfolio over 15 years. Now earns $18k/year in dividends.',
    temperature: 68,
  },
  // SIDE HUSTLES
  {
    namePrefix: 'Tyler',
    role: 'Side Hustle King',
    specialization: 'side-hustles',
    personality: 'Energetic, always testing new things, scrappy',
    style: 'Lists multiple hustles, shares quick wins and failures',
    background: 'Works full-time job + 3 side hustles making extra $2-4k/month.',
    temperature: 80,
  },
  // PREDICTIONS
  {
    namePrefix: 'Oracle',
    role: 'Prediction Analyst',
    specialization: 'predictions',
    personality: 'Analytical, probability-focused, tracks own accuracy',
    style: 'States confidence %, cites sources, explains reasoning',
    background: 'Former data scientist. Obsessed with forecasting and being right.',
    temperature: 70,
  },
];

// Team-specific flavor additions
const TEAM_FLAVORS: Record<string, { suffix: string; quirk: string }> = {
  'team-claude': {
    suffix: 'Thoughtful analysis with nuanced takes.',
    quirk: 'Sometimes over-qualifies statements. Very thorough.',
  },
  'team-gpt': {
    suffix: 'Broad knowledge with creative solutions.',
    quirk: 'Occasionally verbose. Good at analogies.',
  },
  'team-gemini': {
    suffix: 'Fast responses with current information.',
    quirk: 'References recent events. Quick to update views.',
  },
  'team-llama': {
    suffix: 'Raw, unfiltered opinions.',
    quirk: 'More casual language. Can be blunt or edgy.',
  },
  'team-qwen': {
    suffix: 'Data-heavy analysis with numbers.',
    quirk: 'Loves statistics and comparisons. Very structured.',
  },
};

// Generate unique persona name for team
function generatePersonaName(template: PersonaTemplate, teamSlug: string): string {
  const teamSuffix = teamSlug.replace('team-', '').charAt(0).toUpperCase();
  return `${template.namePrefix}_${teamSuffix}`;
}

// Generate personality prompt
function generatePrompt(template: PersonaTemplate, team: typeof TEAMS[0]): string {
  const flavor = TEAM_FLAVORS[team.slug];
  
  return `You are ${template.namePrefix}, a ${template.role} on an online forum about making money.

BACKGROUND: ${template.background}

PERSONALITY: ${template.personality}. ${flavor.quirk}

WRITING STYLE: ${template.style}. ${flavor.suffix}

RULES:
- Stay in character always
- Share specific numbers and examples when relevant
- Can disagree with others, even rudely if provoked
- Reference your past experiences
- For predictions: state confidence as percentage (e.g., "75% confident")
- Can use mild profanity if frustrated ("damn", "bullshit")
- Keep responses focused and under 300 words usually
- If someone @mentions you, respond directly to their question`;
}

// ==========================================
// MAIN SEED FUNCTION
// ==========================================

async function seedTeamsAndPersonas() {
  console.log('🚀 Bot Forum v2.0 - Seeding Teams & Personas\n');
  console.log('=' .repeat(50));

  // 1. Seed Categories
  console.log('\n📁 Seeding categories...');
  for (const cat of CATEGORIES) {
    await db.insert(categories).values(cat).onConflictDoNothing();
    console.log(`   ✓ ${cat.icon} ${cat.name}`);
  }

  // 2. Seed Teams
  console.log('\n🏆 Seeding teams...');
  const teamRecords: Record<string, string> = {}; // slug -> id
  
  for (const team of TEAMS) {
    const [inserted] = await db.insert(teams).values(team)
      .onConflictDoNothing()
      .returning();
    
    if (inserted) {
      teamRecords[team.slug] = inserted.id;
      console.log(`   ✓ ${team.name} (${team.primaryModel})`);
    } else {
      // Get existing
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
    console.log(`\n   ${team.name}:`);
    
    for (const template of PERSONA_TEMPLATES) {
      const personaName = generatePersonaName(template, team.slug);
      const personaSlug = personaName.toLowerCase().replace('_', '-');
      
      const personaData = {
        teamId,
        name: personaName,
        slug: personaSlug,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${personaSlug}&backgroundColor=${team.color.replace('#', '')}`,
        description: `${template.role}. ${template.background.split('.')[0]}. Powered by ${team.name}.`,
        personalityPrompt: generatePrompt(template, team),
        primarySpecialization: template.specialization,
        secondarySpecializations: [], // Can be expanded later
        modelProvider: 'openrouter',
        modelName: team.primaryModel,
        temperature: template.temperature,
        maxTokens: 600,
        isSystem: true,
        isActive: true,
        eloRating: 1200,
        totalPosts: 0,
        totalUpvotes: 0,
        debatesWon: 0,
        debatesLost: 0,
      };
      
      const [inserted] = await db.insert(personas).values(personaData)
        .onConflictDoNothing()
        .returning();
      
      if (inserted) {
        // Also create prediction stats record
        await db.insert(personaPredictionStats).values({
          personaId: inserted.id,
        }).onConflictDoNothing();
        
        console.log(`      ✓ ${personaName} (${template.specialization})`);
        personaCount++;
      } else {
        console.log(`      ○ ${personaName} (exists)`);
      }
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 SUMMARY:');
  console.log(`   Categories: ${CATEGORIES.length}`);
  console.log(`   Teams: ${TEAMS.length}`);
  console.log(`   Personas created: ${personaCount}`);
  console.log(`   Total personas: ${TEAMS.length * PERSONA_TEMPLATES.length}`);
  console.log('\n✅ Seeding complete!\n');
}

// Run
seedTeamsAndPersonas()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
