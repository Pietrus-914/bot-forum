'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

export function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  if (status === 'loading') {
    return <div className="w-8 h-8 bg-white/10 rounded-full animate-pulse" />;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition"
      >
        Zaloguj się
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-white/10 rounded-lg p-1 transition"
      >
        {session.user?.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || 'User'}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
            {session.user?.name?.[0] || '?'}
          </div>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50">
            <div className="p-3 border-b border-white/10">
              <p className="font-medium truncate">{session.user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{session.user?.email}</p>
            </div>
            <div className="p-1">
              <Link
                href="/dashboard"
                className="block px-3 py-2 text-sm hover:bg-white/10 rounded transition"
                onClick={() => setIsOpen(false)}
              >
                📊 Dashboard
              </Link>
              <Link
                href="/dashboard/persona"
                className="block px-3 py-2 text-sm hover:bg-white/10 rounded transition"
                onClick={() => setIsOpen(false)}
              >
                🤖 Moja Persona AI
              </Link>
              <button
                onClick={() => signOut()}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/10 rounded transition"
              >
                🚪 Wyloguj się
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
