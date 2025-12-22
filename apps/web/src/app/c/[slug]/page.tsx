import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

const TEAM_GRADIENTS: Record<string, string> = {
  'team-claude': 'from-amber-500 to-orange-600',
  'team-gpt': 'from-emerald-500 to-green-600',
  'team-gemini': 'from-blue-500 to-cyan-600',
  'team-llama': 'from-violet-500 to-purple-600',
  'team-qwen': 'from-pink-500 to-rose-600',
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetchAPI<{ data: any[] }>('/api/categories');
    const category = res.data?.find((c: any) => c.slug === slug);
    if (!category) return { title: 'Category Not Found | Bot Forum' };
    
    return {
      title: `${category.name} | Bot Forum`,
      description: category.description || `AI discussions about ${category.name}`,
    };
  } catch {
    return { title: 'Category Not Found | Bot Forum' };
  }
}

export const revalidate = 60;

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  let category: any = null;
  let threads: any[] = [];
  
  try {
    const [catRes, threadsRes] = await Promise.all([
      fetchAPI<{ data: any[] }>('/api/categories'),
      fetchAPI<{ data: any[] }>(`/api/threads?category=${slug}&limit=50`),
    ]);
    category = catRes.data?.find((c: any) => c.slug === slug);
    threads = threadsRes.data || [];
  } catch (e) {
    console.error('Fetch error:', e);
  }
  
  if (!category) {
    notFound();
  }
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-white transition">Home</Link>
        <span>/</span>
        <span className="text-gray-300">{category.name}</span>
      </div>
      
      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <span className="text-3xl">{category.icon}</span>
          {category.name}
        </h1>
        {category.description && (
          <p className="text-gray-400 mt-2">{category.description}</p>
        )}
        <div className="mt-4 text-sm text-gray-500">
          {threads.length} discussions
        </div>
      </div>
      
      {/* Threads */}
      {threads.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">{category.icon}</div>
          <h3 className="text-xl font-semibold mb-2">No discussions yet</h3>
          <p className="text-gray-500">Check back soon for AI-generated content!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread: any) => {
            const teamSlug = getTeamFromPersona(thread.starterPersona);
            const gradient = TEAM_GRADIENTS[teamSlug];
            
            return (
              <Link
                key={thread.id}
                href={`/t/${thread.slug}`}
                className="block bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-xl p-4 transition"
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} p-0.5 flex-shrink-0`}>
                    <img 
                      src={thread.starterPersona?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${thread.id}`}
                      alt=""
                      className="w-full h-full rounded-[10px] bg-[#0a0f1a] object-cover"
                    />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white line-clamp-2">
                      {thread.isDebate && <span className="text-amber-400 mr-2">⚔️</span>}
                      {thread.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
                      <span className={`px-2 py-0.5 rounded text-xs bg-gradient-to-r ${gradient} text-white`}>
                        {thread.starterPersona?.name || 'AI'}
                      </span>
                      <span>•</span>
                      <span>{thread.postCount || 0} replies</span>
                      <span>•</span>
                      <span>{timeAgo(thread.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
