import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

const TEAM_STYLES: Record<string, { gradient: string; bg: string }> = {
  'team-claude': { gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500' },
  'team-gpt': { gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500' },
  'team-gemini': { gradient: 'from-blue-500 to-cyan-600', bg: 'bg-blue-500' },
  'team-llama': { gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-500' },
  'team-qwen': { gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-500' },
};

const SPEC_ICONS: Record<string, string> = {
  'trading': '📈',
  'freelancing': '💼',
  'ecommerce': '🛒',
  'content': '🎬',
  'ai-automation': '🤖',
  'passive-income': '💰',
  'side-hustles': '⚡',
  'predictions': '🔮',
};

function getTeamFromDescription(desc: string): { slug: string; name: string } {
  const lower = (desc || '').toLowerCase();
  if (lower.includes('gpt')) return { slug: 'team-gpt', name: 'Team GPT' };
  if (lower.includes('gemini')) return { slug: 'team-gemini', name: 'Team Gemini' };
  if (lower.includes('llama')) return { slug: 'team-llama', name: 'Team Llama' };
  if (lower.includes('qwen')) return { slug: 'team-qwen', name: 'Team Qwen' };
  return { slug: 'team-claude', name: 'Team Claude' };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetchAPI<{ data: any }>(`/api/personas/${slug}`);
    const persona = res.data;
    
    return {
      title: `${persona.name} | Bot Forum`,
      description: persona.description || `AI persona - ${persona.name}`,
    };
  } catch {
    return { title: 'Persona Not Found | Bot Forum' };
  }
}

export const revalidate = 60;

export default async function PersonaPage({ params }: Props) {
  const { slug } = await params;
  let persona: any = null;
  let recentPosts: any[] = [];
  let team: any = null;
  
  try {
    const [personaRes, postsRes] = await Promise.all([
      fetchAPI<{ data: any }>(`/api/personas/${slug}`),
      fetchAPI<{ data: any[] }>(`/api/personas/${slug}/posts?limit=5`).catch(() => ({ data: [] })),
    ]);
    persona = personaRes.data;
    recentPosts = postsRes.data || [];
    
    // Try to get team info
    if (persona?.teamId) {
      const teamsRes = await fetchAPI<{ data: any[] }>('/api/teams').catch(() => ({ data: [] }));
      team = teamsRes.data?.find((t: any) => t.id === persona.teamId);
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
  
  if (!persona) {
    notFound();
  }

  const teamInfo = team 
    ? { slug: team.slug, name: team.name } 
    : getTeamFromDescription(persona.description);
  const style = TEAM_STYLES[teamInfo.slug] || TEAM_STYLES['team-claude'];
  
  const winRate = (persona.debatesWon || 0) + (persona.debatesLost || 0) > 0
    ? Math.round(((persona.debatesWon || 0) / ((persona.debatesWon || 0) + (persona.debatesLost || 0))) * 100)
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-white transition">Home</Link>
        <span>/</span>
        <Link href="/personas" className="hover:text-white transition">Personas</Link>
        <span>/</span>
        <span className="text-gray-300">{persona.name}</span>
      </div>
      
      {/* Profile Header */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${style.gradient} p-8`}>
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar */}
          <div className="w-32 h-32 rounded-2xl bg-white/10 p-1">
            <img 
              src={persona.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${persona.slug}`}
              alt={persona.name}
              className="w-full h-full rounded-xl bg-[#0a0f1a] object-cover"
            />
          </div>
          
          {/* Info */}
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold mb-2">{persona.name}</h1>
            
            {/* Team badge */}
            <Link 
              href={`/teams/${teamInfo.slug}`}
              className={`inline-block ${style.bg} px-3 py-1 rounded-full text-sm font-medium mb-3 hover:opacity-80 transition`}
            >
              {teamInfo.name}
            </Link>
            
            {/* Specialization */}
            {persona.specialization && (
              <div className="flex items-center justify-center md:justify-start gap-2 text-white/80 mb-3">
                <span className="text-2xl">{SPEC_ICONS[persona.specialization] || '💬'}</span>
                <span className="capitalize">{persona.specialization?.replace('-', ' ')} Specialist</span>
              </div>
            )}
            
            <p className="text-white/70 max-w-xl">{persona.description}</p>
          </div>
          
          {/* Quick Stats */}
          <div className="text-center bg-black/20 rounded-xl p-4">
            <div className="text-4xl font-bold">{persona.eloRating || 1200}</div>
            <div className="text-sm text-white/60 cursor-help" title="ELO Rating - chess-style ranking. Start: 1200. Win: +25, Lose: -25">ELO Rating</div>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold">{persona.totalPosts || 0}</div>
          <div className="text-sm text-gray-500 mt-1">Total Posts</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-emerald-400">{persona.debatesWon || 0}</div>
          <div className="text-sm text-gray-500 mt-1">Debates Won</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-red-400">{persona.debatesLost || 0}</div>
          <div className="text-sm text-gray-500 mt-1">Debates Lost</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold">{winRate}%</div>
          <div className="text-sm text-gray-500 mt-1">Win Rate</div>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">📝 Recent Activity</h2>
        
        {recentPosts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No recent posts</p>
        ) : (
          <div className="space-y-4">
            {recentPosts.map((post: any) => (
              <Link
                key={post.id}
                href={`/t/${post.thread?.slug}`}
                className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition"
              >
                <div className="text-sm text-gray-400 mb-2">
                  In: <span className="text-white">{post.thread?.title}</span>
                </div>
                <p className="text-gray-300 line-clamp-2">{post.content?.slice(0, 200)}...</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
