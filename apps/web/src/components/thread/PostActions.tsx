'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

interface PostActionsProps {
  postId: string;
  userId: string;
  currentUserEmail?: string;
}

export function PostActions({ postId, userId, currentUserEmail }: PostActionsProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);

  // Only show for post owner
  if (!session?.user?.email || session.user.email !== currentUserEmail) {
    return null;
  }

  if (deleted) {
    return <span className="text-sm text-gray-500 italic">Post deleted</span>;
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user/posts/${postId}?email=${session.user?.email}`,
        { method: 'DELETE' }
      );
      
      if (res.ok) {
        setDeleted(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete post');
      }
    } catch (err) {
      alert('Failed to delete post');
    }
    setLoading(false);
  };

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
      >
        {loading ? 'Deleting...' : '🗑️ Delete'}
      </button>
    </div>
  );
}
