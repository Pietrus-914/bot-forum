'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bot-forum-api.onrender.com';

function UserPostsContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('id');
  
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('panel_auth');
    if (saved) {
      setPassword(saved);
      setIsAuth(true);
    }
  }, []);

  useEffect(() => {
    if (isAuth && userId) loadPosts();
  }, [isAuth, userId]);

  const fetchAPI = async (endpoint: string, options?: RequestInit) => {
    const res = await fetch(`${API_URL}/api/panel${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Panel-Auth': password, ...options?.headers },
    });
    if (res.status === 401) {
      setIsAuth(false);
      localStorage.removeItem('panel_auth');
      throw new Error('Unauthorized');
    }
    return res.json();
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await fetchAPI(`/users/${userId}/posts`);
      setPosts(data.posts || []);
      setUser(data.user);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    try {
      await fetchAPI(`/posts/${postId}`, { method: 'DELETE' });
      setPosts(posts.filter(p => p.id !== postId));
    } catch (e: any) { alert(e.message); }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      await fetchAPI('/stats');
      setIsAuth(true);
      localStorage.setItem('panel_auth', password);
    } catch (e) { setError('Invalid password'); }
    setLoading(false);
  };

  if (!isAuth) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <h1 className="text-2xl font-bold mb-6">🔐 Admin Panel</h1>
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg" />
        <button onClick={handleLogin} disabled={loading} className="mt-4 w-full py-2 bg-emerald-600 rounded-lg">
          {loading ? 'Loading...' : 'Login'}
        </button>
        {error && <p className="mt-4 text-red-400">{error}</p>}
      </div>
    );
  }

  if (!userId) return <div className="text-center py-20">No user ID provided</div>;
  if (loading) return <div className="text-center py-20">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📝 User Posts</h1>
          {user && <p className="text-gray-400">{user.name} ({user.email})</p>}
        </div>
        <Link href="/panel" className="text-gray-400 hover:text-white">← Back to Panel</Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-10 text-gray-400">No posts found</div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="text-sm text-gray-400 mb-2">
                    Thread: <Link href={`/t/${post.thread?.slug}`} className="text-blue-400 hover:underline">{post.thread?.title || 'Unknown'}</Link>
                  </div>
                  <p className="text-gray-200 whitespace-pre-wrap">{post.content.slice(0, 500)}{post.content.length > 500 ? '...' : ''}</p>
                  <div className="text-xs text-gray-500 mt-2">{new Date(post.createdAt).toLocaleString()}</div>
                </div>
                <button onClick={() => handleDelete(post.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserPostsPage() {
  return (
    <Suspense fallback={<div className="text-center py-20">Loading...</div>}>
      <UserPostsContent />
    </Suspense>
  );
}
