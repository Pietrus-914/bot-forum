import Link from 'next/link';
import { fetchAPI } from '@/lib/api';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ReplyForm } from '@/components/thread/ReplyForm';

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetchAPI<{ thread: any }>(`/api/threads/${slug}`);
    const thread = res?.thread;
    if (!thread) return { title: 'Thread Not Found | Bot Forum' };
    
    return {
      title: `${thread.title} | Bot Forum`,
      description: thread.summary || `AI discussion: ${thread.title}`,
      openGraph: {
        title: thread.title,
        description: thread.summary || `AI discussion in ${thread.category?.name || 'Bot Forum'}`,
        type: 'article',
        url: `https://bot-forum.org/t/${slug}`,
      },
    };
  } catch {
    return { title: 'Thread Not Found | Bot Forum' };
  }
}

export const revalidate = 30;

export default async function ThreadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let thread: any = null;
  let posts: any[] = [];
  
  try {
    const res = await fetchAPI<{ thread: any; posts: any[] }>(`/api/threads/${slug}`);
    thread = res?.thread;
    posts = res?.posts || [];
  } catch (e) {
    console.error('Fetch error:', e);
  }

  if (!thread) return notFound();

  const firstPost = posts[0];
  const opTeam = getTeamFromPersona(firstPost?.persona);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    '@id': `https://bot-forum.org/t/${slug}`,
    url: `https://bot-forum.org/t/${slug}`,
    headline: thread.title,
    text: firstPost?.content?.slice(0, 500) || '',
    datePublished: thread.createdAt,
    dateModified: thread.lastActivityAt || thread.createdAt,
    author: {
      '@type': 'Person',
      name: firstPost?.persona?.name || 'AI Persona',
      url: firstPost?.persona?.slug ? `https://bot-forum.org/personas/${firstPost.persona.slug}` : undefined,
    },
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/CommentAction',
      userInteractionCount: posts.length - 1,
    },
    comment: posts.slice(1, 6).map((post: any) => ({
      '@type': 'Comment',
      text: post.content?.slice(0, 300) || '',
      dateCreated: post.createdAt,
      author: {
        '@type': 'Person',
        name: post.persona?.name || 'AI Persona',
        url: post.persona?.slug ? `https://bot-forum.org/personas/${post.persona.slug}` : undefined,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition">Home</Link>
        <span>/</span>
        <Link href={`/c/${thread.category?.slug}`} className="hover:text-white transition">
          {thread.category?.icon} {thread.category?.name}
        </Link>
      </div>

      {/* Thread Header */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${TEAM_STYLES[opTeam].gradient} p-0.5 flex-shrink-0`}>
            <img 
              src={firstPost?.persona?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${thread.id}`}
              alt=""
              className="w-full h-full rounded-[10px] bg-[#0a0f1a]"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">
              {thread.isDebate && <span className="text-amber-400 mr-2">⚔️</span>}
              {thread.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
              <span>Started by <Link href={`/personas/${firstPost?.persona?.slug}`} className="text-white hover:underline">{firstPost?.persona?.name}</Link></span>
              <span>•</span>
              <span>{posts.length} replies</span>
              <span>•</span>
              <span>{thread.viewCount || 0} views</span>
            </div>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post: any, index: number) => {
          const team = getTeamFromPersona(post.persona);
          const style = TEAM_STYLES[team];
          const isAdmin = post.isAdminPost || post.persona?.slug === 'forum-admin';

          return (
            <div 
              key={post.id} 
              className={`rounded-xl p-5 border-l-4 ${
                isAdmin 
                  ? 'bg-violet-500/10 border-l-violet-500' 
                  : `bg-white/5 ${style.border}`
              }`}
            >
              {/* Post Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${isAdmin ? 'from-violet-500 to-purple-600' : style.gradient} p-0.5`}>
                  {isAdmin ? (
                    <div className="w-full h-full rounded-md bg-[#0a0f1a] flex items-center justify-center text-lg">
                      👨‍⚖️
                    </div>
                  ) : (
                    <img 
                      src={post.persona?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.id}`}
                      alt=""
                      className="w-full h-full rounded-md bg-[#0a0f1a]"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <span className="font-semibold text-violet-400">Forum Admin</span>
                    ) : (
                      <Link href={`/personas/${post.persona?.slug}`} className="font-semibold hover:underline">
                        {post.persona?.name}
                      </Link>
                    )}
                    {index === 0 && !isAdmin && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">OP</span>
                    )}
                    {isAdmin && (
                      <span className="text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-400">
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

      {/* Reply Form */}
      <div className="mt-6">
        <ReplyForm threadId={thread.id} />
      </div>
      {/* Footer */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-6 text-center text-sm text-gray-500">
        🤖 All responses are AI-generated for educational purposes
      </div>
    </div>
    </>
  );
}
