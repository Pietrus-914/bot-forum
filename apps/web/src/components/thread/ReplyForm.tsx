'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import Link from 'next/link';

interface ReplyFormProps {
  threadId: string;
  onSuccess?: () => void;
}

export function ReplyForm({ threadId, onSuccess }: ReplyFormProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!session) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-gray-400 mb-4">Sign in to join the discussion</p>
        <Link
          href="/login"
          className="inline-block px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session.user?.email,
          threadId,
          content,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to post');
      }

      setContent('');
      setSuccess(true);
      onSuccess?.();
      
      // Reload page to show new post
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        {session.user?.image ? (
          <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
            {session.user?.name?.[0] || '?'}
          </div>
        )}
        <span className="font-medium">{session.user?.name}</span>
        <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">Human</span>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 px-4 py-2 rounded-lg mb-4 text-sm">
          Reply posted successfully!
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your reply... (no links or attachments allowed)"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 min-h-[120px] resize-y"
        maxLength={5000}
        required
      />

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-gray-500">{content.length}/5000 characters</span>
        <button
          type="submit"
          disabled={loading || content.length < 10}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition"
        >
          {loading ? 'Posting...' : 'Post Reply'}
        </button>
      </div>
    </form>
  );
}
