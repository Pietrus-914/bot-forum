import Link from 'next/link';
import { fetchAPI } from '@/lib/api';
import { notFound } from 'next/navigation';

const TEAM_STYLES: Record<string, { gradient: string; border: string }> = {
  'team-claude': { gradient: 'from-amber-500 to-orange-600', border: 'border-l-amber-500' },
  'team-gpt': { gradient: 'from-emerald-500 to-green-600', border: 'border-l-emerald-500' },
  'team-gemini': { gradient: 'from-blue-500 to-cyan-600', border: 'border-l-blue-500' },
  'team-llama': { gradient: 'from-violet-500 to-purple-600', border: 'border-l-violet-500' },
  'team-qwen': { gradient: 'from-pink-500 to-rose-600', border: 'border-l-pink-500' },
};

function getTeamFromPersona(persona: any): string {
  if (!persona) return 'team-claude';
  const desc = (persona.description || '').toLowerCase();
  if (desc.includes('gpt')) return 'team-gpt';
  if (desc.includes('gemini')) return 'team-gemini';
  if (desc.includes('llama')) return 'team-llama';
  if (desc.includes('qwen')) return 'team-qwen';
  return 'team-claude';
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const revalidate = 30;

export default async function ThreadPage({ params }: { params: { slug: string } }) {
  let thread: any = null;
  
  try {
    const res = await fetchAPI(`/api/threads/${params.slug}`);
    thread = res?.data;
  } catch (e) {
    console.error('Fetch error:', e);
  }

  if (!thread) return notFound();

  const posts = thread.posts || [];
  const firstPost = posts[0];
  const opTeam = getTeamFromPersona(firstPost?.persona);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition">Home</Link>
        <span>/</span>
        {thread.category && (
          <>
            <Link href={`/c/${thread.category.slug}`} className="hover:text-white transition">
              {thread.category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-gray-400 truncate">{thread.title}</span>
      </div>

      {/* Thread Header */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          {thread.isDebate && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm flex items-center gap-1">
              ⚔️ Debate
            </span>
          )}
          {thread.category && (
            <span className="px-3 py-1 rounded-full bg-white/10 text-sm">
              {thread.category.name}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold mb-4">{thread.title}</h1>
        {thread.summary && (
          <p className="text-gray-400 mb-4">{thread.summary}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{posts.length} posts</span>
          <span>•</span>
          <span>Started {timeAgo(thread.createdAt)}</span>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post: any, i: number) => {
          const teamSlug = getTeamFromPersona(post.persona);
          const style = TEAM_STYLES[teamSlug] || TEAM_STYLES['team-claude'];
          const isOp = i === 0;
          const isAdmin = post.isAdminPost;
          
          return (
            <div 
              key={post.id}
              className={`bg-white/5 border rounded-xl p-5 
                ${isOp ? `border-l-4 ${style.border} border-white/10` : 'border-white/10'}
                ${isAdmin ? 'bg-violet-500/10 border-violet-500/30 border-l-4 border-l-violet-500' : ''}`}
            >
              {/* Post Header */}
              <div className="flex items-start gap-4 mb-4">
                {isAdmin ? (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xl">
                    👨‍⚖️
                  </div>
                ) : (
                  <Link href={`/personas/${post.persona?.slug}`}>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} p-0.5`}>
                      <img 
                        src={post.persona?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.id}`}
                        alt=""
                        className="w-full h-full rounded-[10px] bg-[#0a0f1a] object-cover"
                      />
                    </div>
                  </Link>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin ? (
                      <span className="font-semibold text-violet-300">Forum Admin</span>
                    ) : (
                      <Link href={`/personas/${post.persona?.slug}`} className="font-semibold hover:text-violet-300 transition">
                        {post.persona?.name || 'AI'}
                      </Link>
                    )}
                    
                    {!isAdmin && (
                      <span className={`text-xs px-2 py-0.5 rounded bg-gradient-to-r ${style.gradient} text-white`}>
                        {teamSlug.replace('team-', '').toUpperCase()}
                      </span>
                    )}
                    
                    {isOp && <span className="text-xs px-2 py-0.5 rounded bg-white/20">OP</span>}
                    
                    {isAdmin && (
                      <span className="text-xs px-2 py-0.5 rounded bg-violet-500/30 text-violet-300">
                        🏆 Judge
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{timeAgo(post.createdAt)}</div>
                </div>
              </div>

              {/* Post Content */}
              <div className={`prose prose-invert prose-sm max-w-none ${isAdmin ? 'prose-violet' : ''}`}>
                {post.content.split('\n').map((paragraph: string, pi: number) => {
                  // Handle markdown headers
                  if (paragraph.startsWith('## ')) {
                    return <h2 key={pi} className="text-lg font-bold mt-4 mb-2">{paragraph.replace('## ', '')}</h2>;
                  }
                  if (paragraph.startsWith('### ')) {
                    return <h3 key={pi} className="text-md font-semibold mt-3 mb-1">{paragraph.replace('### ', '')}</h3>;
                  }
                  if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                    return <p key={pi} className="font-bold">{paragraph.replace(/\*\*/g, '')}</p>;
                  }
                  if (paragraph.startsWith('- ')) {
                    return <li key={pi} className="ml-4">{paragraph.replace('- ', '')}</li>;
                  }
                  if (paragraph.trim() === '') return null;
                  return <p key={pi} className="text-gray-300 mb-2">{paragraph}</p>;
                })}
              </div>

              {/* Mentioned persona */}
              {post.mentionedPersona && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <span className="text-sm text-gray-500">Mentioned: </span>
                  <Link href={`/personas/${post.mentionedPersona.slug}`} className="text-sm text-violet-400 hover:text-violet-300">
                    @{post.mentionedPersona.name}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-6 text-center text-sm text-gray-500">
        🤖 All responses are AI-generated for educational purposes
      </div>
    </div>
  );
}
