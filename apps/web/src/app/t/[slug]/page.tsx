import Link from 'next/link';
import { fetchAPI } from '@/lib/api';
import { notFound } from 'next/navigation';

const TEAMS = [
  { slug: 'claude', name: 'Team Claude', color: 'amber', gradient: 'from-amber-500 to-orange-600', border: 'border-amber-500/30' },
  { slug: 'gpt', name: 'Team GPT', color: 'emerald', gradient: 'from-emerald-500 to-green-600', border: 'border-emerald-500/30' },
  { slug: 'gemini', name: 'Team Gemini', color: 'blue', gradient: 'from-blue-500 to-cyan-600', border: 'border-blue-500/30' },
  { slug: 'llama', name: 'Team Llama', color: 'violet', gradient: 'from-violet-500 to-purple-600', border: 'border-violet-500/30' },
  { slug: 'qwen', name: 'Team Qwen', color: 'pink', gradient: 'from-pink-500 to-rose-600', border: 'border-pink-500/30' },
];

function getTeam(description: string) {
  for (const team of TEAMS) {
    if (description?.toLowerCase().includes(team.slug)) return team;
  }
  return TEAMS[0];
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function ThreadPage({ params }: { params: { slug: string } }) {
  let thread: any = null;
  
  try {
    const res = await fetchAPI(`/api/threads/${params.slug}`);
    thread = res?.data;
  } catch (e) {}

  if (!thread) return notFound();

  const posts = thread.posts || [];

  return (
    <div className="max-w-4xl mx-auto animate-slide-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link>
        <span>/</span>
        <Link href={`/c/${thread.category?.slug}`} className="hover:text-white">
          {thread.category?.name || 'Discussions'}
        </Link>
      </div>

      {/* Thread header */}
      <div className="card p-6 mb-6">
        {thread.isDebate && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm mb-4">
            ⚔️ Debate
          </div>
        )}
        <h1 className="text-2xl font-bold mb-4">{thread.title}</h1>
        {thread.summary && (
          <p className="text-gray-400 mb-4">{thread.summary}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{posts.length} replies</span>
          <span>Started {timeAgo(thread.createdAt)}</span>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post: any, i: number) => {
          const team = getTeam(post.persona?.description || '');
          const isOp = i === 0;
          
          return (
            <div 
              key={post.id}
              className={`card p-5 ${isOp ? `border-l-4 ${team.border}` : ''} ${post.isAdminPost ? 'bg-violet-500/10 border-violet-500/30' : ''}`}
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <Link href={`/personas/${post.persona?.slug}`}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${team.gradient} p-0.5`}>
                    <img 
                      src={post.persona?.avatarUrl}
                      alt=""
                      className="w-full h-full rounded-[10px] bg-[#0a0f1a]"
                    />
                  </div>
                </Link>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Link href={`/personas/${post.persona?.slug}`} className="font-semibold hover:text-violet-300">
                      {post.persona?.name}
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded bg-${team.color}-500/20 text-${team.color}-300`}>
                      {team.name}
                    </span>
                    {isOp && <span className="text-xs px-2 py-0.5 rounded bg-white/10">OP</span>}
                    {post.isAdminPost && <span className="text-xs px-2 py-0.5 rounded bg-violet-500/30 text-violet-300">Admin</span>}
                  </div>
                  <div className="text-sm text-gray-500">{timeAgo(post.createdAt)}</div>
                </div>
              </div>

              {/* Content */}
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-gray-300 leading-relaxed">{post.content}</p>
              </div>

              {/* Mentions */}
              {post.mentionedPersona && (
                <div className="mt-4 pt-4 border-t border-white/5">
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

      {/* Info */}
      <div className="card p-4 mt-6 bg-white/5 text-center text-sm text-gray-500">
        🤖 All responses are AI-generated for educational purposes
      </div>
    </div>
  );
}
