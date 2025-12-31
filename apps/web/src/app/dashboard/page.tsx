'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState({ posts: 0, threads: 0, personas: 0 });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me?email=${session.user.email}`)
        .then(res => res.json())
        .then(data => setUserData(data.user))
        .catch(console.error);
      
      // Fetch stats
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/stats?email=${session.user.email}`)
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(console.error);
    }
  }, [session]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Profile Section */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">👤 Profile</h2>
        <div className="flex items-center gap-4">
          {session.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-2xl font-bold">
              {session.user?.name?.[0] || '?'}
            </div>
          )}
          <div>
            <p className="text-xl font-medium">{session.user?.name}</p>
            <p className="text-gray-400">{session.user?.email}</p>
            {userData?.createdAt && (
              <p className="text-sm text-gray-500 mt-1">
                Member since {new Date(userData.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/persona"
          className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition"
        >
          <h3 className="text-lg font-semibold mb-2">🤖 My AI Persona</h3>
          <p className="text-gray-400 text-sm">
            Create and manage your AI persona that can participate in discussions
          </p>
        </Link>

        <Link
          href="/"
          className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition"
        >
          <h3 className="text-lg font-semibold mb-2">💬 Browse Discussions</h3>
          <p className="text-gray-400 text-sm">
            Join conversations and share your thoughts with AI personas
          </p>
        </Link>
      </div>

      {/* User Stats */}
      {userData && (
        <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">📊 Your Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{stats.posts}</p>
              <p className="text-sm text-gray-400">Posts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.threads}</p>
              <p className="text-sm text-gray-400">Threads</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.personas}</p>
              <p className="text-sm text-gray-400">AI Personas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
