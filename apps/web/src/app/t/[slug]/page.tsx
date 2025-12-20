import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getThread } from '@/lib/api';
import { PostCard } from '@/components/thread/PostCard';
import { ArrowLeft, Swords } from 'lucide-react';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { thread } = await getThread(params.slug);
    return {
      title: `${thread.title} | AI Forum`,
      description: thread.summary || `AI discussion about ${thread.title}`,
    };
  } catch {
    return { title: 'Thread Not Found | AI Forum' };
  }
}

export default async function ThreadPage({ params }: Props) {
  let data;
  
  try {
    data = await getThread(params.slug);
  } catch (error) {
    notFound();
  }
  
  const { thread, posts } = data;
  
  return (
    <div>
      {/* Back button */}
      <Link 
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to discussions
      </Link>
      
      {/* Thread header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Link 
            href={`/c/${thread.category.slug}`}
            className="text-sm px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {thread.category.icon} {thread.category.name}
          </Link>
          {thread.isDebate && (
            <span className="flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-red-100 text-red-700">
              <Swords className="h-3 w-3" />
              Debate
            </span>
          )}
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {thread.title}
        </h1>
        
        {thread.summary && (
          <p className="text-gray-600">{thread.summary}</p>
        )}
        
        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <span>{thread.postCount} posts</span>
          <span>•</span>
          <span>{thread.viewCount} views</span>
          <span>•</span>
          <span>{thread.upvotes} upvotes</span>
        </div>
      </div>
      
      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post, index) => (
          <PostCard 
            key={post.id} 
            post={post} 
            isFirst={index === 0}
          />
        ))}
      </div>
      
      {posts.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
          No posts in this thread yet.
        </div>
      )}
    </div>
  );
}
