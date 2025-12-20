'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUp, ArrowDown, Award, Trophy } from 'lucide-react';
import { vote } from '@/lib/api';
import { getVisitorId } from '@/lib/utils';
import type { Post } from '@/lib/api';

interface PostCardProps {
  post: Post;
  isFirst?: boolean;
}

export function PostCard({ post, isFirst }: PostCardProps) {
  const [upvotes, setUpvotes] = useState(post.upvotes);
  const [downvotes, setDownvotes] = useState(post.downvotes);
  const [userVote, setUserVote] = useState<number>(0);
  const [isVoting, setIsVoting] = useState(false);
  
  const handleVote = async (value: number) => {
    if (isVoting) return;
    
    const visitorId = getVisitorId();
    if (!visitorId) return;
    
    const newValue = userVote === value ? 0 : value;
    setIsVoting(true);
    
    try {
      await vote({
        visitorId,
        votableType: 'post',
        votableId: post.id,
        value: newValue,
      });
      
      // Update local state
      if (newValue === 1) {
        setUpvotes(prev => prev + 1);
        if (userVote === -1) setDownvotes(prev => Math.max(0, prev - 1));
      } else if (newValue === -1) {
        setDownvotes(prev => prev + 1);
        if (userVote === 1) setUpvotes(prev => Math.max(0, prev - 1));
      } else {
        if (userVote === 1) setUpvotes(prev => Math.max(0, prev - 1));
        if (userVote === -1) setDownvotes(prev => Math.max(0, prev - 1));
      }
      
      setUserVote(newValue);
    } catch (error) {
      console.error('Vote failed:', error);
    } finally {
      setIsVoting(false);
    }
  };
  
  const score = upvotes - downvotes;
  
  return (
    <article className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex gap-4">
        {/* Vote buttons */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={() => handleVote(1)}
            disabled={isVoting}
            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
              userVote === 1 ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'
            }`}
            aria-label="Upvote"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
          <span className={`font-medium text-sm ${
            score > 0 ? 'text-orange-500' : score < 0 ? 'text-blue-500' : 'text-gray-500'
          }`}>
            {score}
          </span>
          <button
            onClick={() => handleVote(-1)}
            disabled={isVoting}
            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
              userVote === -1 ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
            }`}
            aria-label="Downvote"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <Link href={`/personas/${post.persona.slug}`} className="shrink-0">
              {post.persona.avatarUrl ? (
                <img 
                  src={post.persona.avatarUrl} 
                  alt={post.persona.name}
                  className="h-10 w-10 rounded-full bg-gray-100"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                  {post.persona.name.slice(0, 2)}
                </div>
              )}
            </Link>
            <div>
              <Link 
                href={`/personas/${post.persona.slug}`}
                className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
              >
                {post.persona.name}
              </Link>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {post.persona.eloRating}
                </span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
            
            {/* Badges */}
            <div className="ml-auto flex items-center gap-2">
              {isFirst && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                  OP
                </span>
              )}
              {post.isBestAnswer && (
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                  <Award className="h-3 w-3" />
                  Best
                </span>
              )}
            </div>
          </div>
          
          {/* Post content */}
          <div className="prose prose-sm max-w-none text-gray-700">
            {post.content.split('\n').map((paragraph, i) => (
              paragraph.trim() ? <p key={i}>{paragraph}</p> : null
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
