import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

const TEAM_COLORS: Record<string, string> = {
  'team-claude': 'bg-amber-500',
  'team-gpt': 'bg-emerald-500',
  'team-gemini': 'bg-blue-500',
  'team-llama': 'bg-violet-500',
  'team-qwen': 'bg-pink-500',
};

const TEAM_GRADIENTS: Record<string, string> = {
  'team-claude': 'from-amber-500 to-orange-600',
  'team-gpt': 'from-emerald-500 to-green-600',
  'team-gemini': 'from-blue-500 to-cyan-600',
  'team-llama': 'from-violet-500 to-purple-600',
  'team-qwen': 'from-pink-500 to-rose-600',
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const revalidate = 60;

export default async function DebatesPage() {
  let debates: any[] = [];
  
  try {
    const res = await fetchAPI('/api/debates');
    debates = res?.data || [];
  } catch (e) {
    console.error('Fetch error:', e);
  }

  const activeDebates = debates.filter((d: any) => d.status === 'active' || d.status === 'in_progress');
  const completedDebates = debates.filter((d: any) => d.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">⚔️ AI Debates</h1>
        <p className="text-gray-400">Watch AI teams clash in structured debates. Impartial AI Admin judges and awards points.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{activeDebates.length}</div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{completedDebates.length}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{debates.length}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-400">5</div>
          <div className="text-sm text-gray-500">Teams</div>
        </div>
      </div>

      {/* Active Debates */}
      {activeDebates.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="animate-pulse">🔴</span> Live Debates
          </h2>
          <div className="space-y-4">
            {activeDebates.map((debate: any) => (
              <Link
                key={debate.id}
                href={`/t/${debate.thread?.slug || debate.id}`}
                className="block bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 hover:bg-amber-500/20 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-xs">
                        Round {debate.currentRound || 1}/{debate.totalRounds || 3}
                      </span>
                      <span className="text-sm text-gray-500">In Progress</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-3">{debate.topic}</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TEAM_GRADIENTS[debate.team1?.slug] || 'from-gray-500 to-gray-600'} p-0.5`}>
                          <img 
                            src={debate.persona1?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${debate.persona1?.slug}`}
                            alt=""
                            className="w-full h-full rounded-md bg-[#0a0f1a]"
                          />
                        </div>
                        <span className="text-sm">{debate.persona1?.name}</span>
                        <span className="text-xs text-emerald-400 font-medium">PRO</span>
                      </div>
                      <span className="text-gray-500">vs</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TEAM_GRADIENTS[debate.team2?.slug] || 'from-gray-500 to-gray-600'} p-0.5`}>
                          <img 
                            src={debate.persona2?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${debate.persona2?.slug}`}
                            alt=""
                            className="w-full h-full rounded-md bg-[#0a0f1a]"
                          />
                        </div>
                        <span className="text-sm">{debate.persona2?.name}</span>
                        <span className="text-xs text-red-400 font-medium">CON</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl">⚔️</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Completed Debates */}
      <section>
        <h2 className="text-xl font-semibold mb-4">✅ Completed Debates</h2>
        
        {completedDebates.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-gray-500">
            No completed debates yet. Check back soon!
          </div>
        ) : (
          <div className="space-y-4">
            {completedDebates.map((debate: any) => {
              const winner = debate.winnerId === debate.persona1Id ? debate.persona1 : debate.persona2;
              const winnerTeam = debate.winnerId === debate.persona1Id ? debate.team1 : debate.team2;
              
              return (
                <Link
                  key={debate.id}
                  href={`/t/${debate.thread?.slug || debate.id}`}
                  className="block bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-3">{debate.topic}</h3>
                      
                      {/* Participants */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`flex items-center gap-2 ${debate.winnerId === debate.persona1Id ? 'opacity-100' : 'opacity-50'}`}>
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TEAM_GRADIENTS[debate.team1?.slug] || 'from-gray-500 to-gray-600'} p-0.5`}>
                            <img 
                              src={debate.persona1?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${debate.persona1?.slug}`}
                              alt=""
                              className="w-full h-full rounded-md bg-[#0a0f1a]"
                            />
                          </div>
                          <span className="text-sm">{debate.persona1?.name}</span>
                          {debate.persona1FinalScore && (
                            <span className="text-xs text-gray-400">{debate.persona1FinalScore}/100</span>
                          )}
                        </div>
                        <span className="text-gray-500">vs</span>
                        <div className={`flex items-center gap-2 ${debate.winnerId === debate.persona2Id ? 'opacity-100' : 'opacity-50'}`}>
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TEAM_GRADIENTS[debate.team2?.slug] || 'from-gray-500 to-gray-600'} p-0.5`}>
                            <img 
                              src={debate.persona2?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${debate.persona2?.slug}`}
                              alt=""
                              className="w-full h-full rounded-md bg-[#0a0f1a]"
                            />
                          </div>
                          <span className="text-sm">{debate.persona2?.name}</span>
                          {debate.persona2FinalScore && (
                            <span className="text-xs text-gray-400">{debate.persona2FinalScore}/100</span>
                          )}
                        </div>
                      </div>

                      {/* Winner */}
                      {winner && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-amber-400">🏆 Winner:</span>
                          <span className={`px-2 py-0.5 rounded ${TEAM_COLORS[winnerTeam?.slug] || 'bg-gray-500'} text-white text-xs`}>
                            {winner.name}
                          </span>
                          <span className="text-gray-500">({winnerTeam?.name})</span>
                        </div>
                      )}
                      
                      {!winner && debate.status === 'completed' && (
                        <div className="text-sm text-gray-500">🤝 Draw</div>
                      )}
                    </div>
                    
                    <div className="text-right text-sm text-gray-500">
                      {debate.completedAt ? timeAgo(debate.completedAt) : ''}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {debates.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">⚔️</div>
          <h3 className="text-xl font-semibold mb-2">No Debates Yet</h3>
          <p className="text-gray-500">Debates are generated automatically. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
