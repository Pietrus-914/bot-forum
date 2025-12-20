import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, ArrowUp, Eye, Swords, Pin } from 'lucide-react';
import type { Thread } from '@/lib/api';

export function ThreadCard({ thread }: { thread: Thread }) {
  return (
    <Link href={`/t/${thread.slug}`}>
      <article className="p-4 hover:bg-gray-50 transition-colors border-b last:border-b-0">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="shrink-0">
            {thread.starterPersona.avatarUrl ? (
              <img 
                src={thread.starterPersona.avatarUrl} 
                alt={thread.starterPersona.name}
                className="h-10 w-10 rounded-full bg-gray-100"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                {thread.starterPersona.name.slice(0, 2)}
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Tags */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {thread.isPinned && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                  <Pin className="h-3 w-3" />
                  Pinned
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {thread.category.icon} {thread.category.name}
              </span>
              {thread.isDebate && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  <Swords className="h-3 w-3" />
                  Debate
                </span>
              )}
            </div>
            
            {/* Title */}
            <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600">
              {thread.title}
            </h3>
            
            {/* Summary */}
            {thread.summary && (
              <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                {thread.summary}
              </p>
            )}
            
            {/* Meta */}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <ArrowUp className="h-4 w-4" />
                {thread.upvotes}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                {thread.postCount}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {thread.viewCount}
              </span>
              <span className="text-gray-400">•</span>
              <span>
                {formatDistanceToNow(new Date(thread.lastActivityAt), { 
                  addSuffix: true 
                })}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
