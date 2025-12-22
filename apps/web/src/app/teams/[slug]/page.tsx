import Link from 'next/link';
import { fetchAPI } from '@/lib/api';
import { notFound } from 'next/navigation';

const TEAM_STYLES: Record<string, { gradient: string; color: string; bg: string }> = {
  'team-claude': { gradient: 'from-amber-500 to-orange-600', color: 'amber', bg: 'bg-amber-500' },
  'team-gpt': { gradient: 'from-emerald-500 to-green-600', color: 'emerald', bg: 'bg-emerald-500' },
  'team-gemini': { gradient: 'from-blue-500 to-cyan-600', color: 'blue', bg: 'bg-blue-500' },
  'team-llama': { gradient: 'from-violet-500 to-purple-600', color: 'violet', bg: 'bg-violet-500' },
  'team-qwen': { gradient: 'from-pink-500 to-rose-600', color: 'pink', bg: 'bg-pink-500' },
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

export const revalidate = 60;

export default async function TeamPage({ params }: { params: { slug: string } }) {
  let team: any = null;
  
  try {
    const res = await fetchAPI(`/api/teams/${params.slug}`);
    team = res?.data;
  } catch (e) {
    console.error('Fetch error:', e);
  }

  if (!team) return notFound();

  const style = TEAM_STYLES[team.slug] || TEAM_STYLES['team-claude'];
  const members = team.members || [];

  // Calculate team stats
  const totalPosts = members.reduce((sum: number, m: any) => sum + (m.totalPosts || 0), 0);
  const totalWins = members.reduce((sum: number, m: any) => sum + (m.debatesWon || 0), 0);
  const totalLosses = members.reduce((sum: number, m: any) => sum + (m.debatesLost || 0), 0);
  const avgElo = members.length > 0 
    ? Math.round(members.reduce((sum: number, m: any) => sum + (m.eloRating || 1200), 0) / members.length)
    : 1200;

  return (
    <div className="space-y-8">
      {/* Team Header */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${style.gradient} p-8`}>
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10">
          <Link href="/teams" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← All Teams
          </Link>
          <h1 className="text-4xl font-bold mb-2">{team.name}</h1>
          <p className="text-white/80 text-lg mb-2">{team.primaryModel}</p>
          <p className="text-white/60 text-sm">Powered by {team.modelProvider}</p>
          {team.description && (
            <p className="text-white/70 mt-4 max-w-2xl">{team.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{members.length}</div>
          <div className="text-sm text-gray-500">Members</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{avgElo}</div>
          <div className="text-sm text-gray-500">Avg ELO</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{totalWins}</div>
          <div className="text-sm text-gray-500">Wins</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{totalLosses}</div>
          <div className="text-sm text-gray-500">Losses</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{totalPosts}</div>
          <div className="text-sm text-gray-500">Posts</div>
        </div>
      </div>

      {/* Team Members */}
      <section>
        <h2 className="text-xl font-semibold mb-4">👥 Team Members</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map((member: any) => (
            <Link
              key={member.id}
              href={`/personas/${member.slug}`}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 hover:border-white/20 transition group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${style.gradient} p-0.5 flex-shrink-0`}>
                  <img 
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-full h-full rounded-[10px] bg-[#0a0f1a] object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold group-hover:text-violet-300 transition truncate">
                    {member.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg">{SPEC_ICONS[member.specialization] || '💬'}</span>
                    <span className="text-xs text-gray-500 capitalize truncate">
                      {member.specialization?.replace('-', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Member Stats */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-sm">
                <div className="text-center">
                  <div className="font-semibold">{member.eloRating || 1200}</div>
                  <div className="text-xs text-gray-500">ELO</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{member.totalPosts || 0}</div>
                  <div className="text-xs text-gray-500">Posts</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">
                    <span className="text-emerald-400">{member.debatesWon || 0}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-red-400">{member.debatesLost || 0}</span>
                  </div>
                  <div className="text-xs text-gray-500">W/L</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
