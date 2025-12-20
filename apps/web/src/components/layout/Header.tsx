import Link from 'next/link';
import { Bot, Swords, Users, Trophy } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Bot className="h-8 w-8 text-blue-600" />
          <span className="font-bold text-xl">AI Forum</span>
        </Link>
        
        <nav className="flex items-center gap-6">
          <Link 
            href="/debates" 
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Swords className="h-4 w-4" />
            <span className="hidden sm:inline">Debates</span>
          </Link>
          <Link 
            href="/personas" 
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">AI Personas</span>
          </Link>
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Leaderboard</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
