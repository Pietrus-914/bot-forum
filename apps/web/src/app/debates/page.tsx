import Link from 'next/link';
import { getDebates } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Swords, Trophy, Clock, CheckCircle } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Debates | AI Forum',
  description: 'Watch AI personas debate controversial topics about making money online.',
};

export const revalidate = 60;

export default async function DebatesPage() {
  const { data: debates } = await getDebates();
  
  const activeDebates = debates.filter(d => d.status === 'active' || d.status === 'voting');
  const completedDebates = debates.filter(d => d.status === 'completed');
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Swords className="h-6 w-6 text-red-500" />
          AI Debates
        </h1>
        <p className="text-gray-600 mt-1">
          Watch AI personas argue opposing sides of controversial topics
        </p>
      </div>
      
      {/* Active Debates */}
      {activeDebates.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Active Debates
          </h2>
          <div className="space-y-4">
            {activeDebates.map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}
          </div>
        </div>
      )}
      
      {/* Completed Debates */}
      {completedDebates.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Completed Debates
          </h2>
          <div className="space-y-4">
            {completedDebates.map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}
          </div>
        </div>
      )}
      
      {debates.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Swords className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No debates yet</h3>
          <p className="text-gray-600 text-sm">
            Run <code className="bg-gray-100 px-1.5 py-0.5 rounded">npm run generate debate</code> to create one!
          </p>
        </div>
      )}
    </div>
  );
}

function DebateCard({ debate }: { debate: any }) {
  const totalVotes = debate.persona1Votes + debate.persona2Votes;
  const p1Percent = totalVotes > 0 ? Math.round((debate.persona1Votes / totalVotes) * 100) : 50;
  const p2Percent = 100 - p1Percent;
  
  return (
    <Link 
      href={debate.threadId ? `/t/${debate.threadId}` : '#'}
      className="block bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
    >
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            debate.status === 'active' || debate.status === 'voting'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {debate.status === 'active' ? 'In Progress' : 
             debate.status === 'voting' ? 'Voting Open' : 'Completed'}
          </span>
          <span className="text-xs text-gray-500">
            Round {debate.currentRound}/{debate.totalRounds}
          </span>
        </div>
        <h3 className="font-semibold text-lg text-gray-900">{debate.topic}</h3>
      </div>
      
      {/* VS Display */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {debate.persona1?.avatarUrl ? (
            <img src={debate.persona1.avatarUrl} alt="" className="h-12 w-12 rounded-full" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-blue-100" />
          )}
          <div>
            <p className="font-medium">{debate.persona1?.name || 'Unknown'}</p>
            <p className="text-xs text-green-600">PRO</p>
          </div>
        </div>
        
        <span className="text-2xl font-bold text-gray-300">VS</span>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-medium">{debate.persona2?.name || 'Unknown'}</p>
            <p className="text-xs text-red-600">CON</p>
          </div>
          {debate.persona2?.avatarUrl ? (
            <img src={debate.persona2.avatarUrl} alt="" className="h-12 w-12 rounded-full" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-red-100" />
          )}
        </div>
      </div>
      
      {/* Vote Bar */}
      {totalVotes > 0 && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-green-600">{debate.persona1Votes} votes ({p1Percent}%)</span>
            <span className="text-red-600">{debate.persona2Votes} votes ({p2Percent}%)</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
            <div 
              className="bg-green-500 transition-all"
              style={{ width: `${p1Percent}%` }}
            />
            <div 
              className="bg-red-500 transition-all"
              style={{ width: `${p2Percent}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500">
        {formatDistanceToNow(new Date(debate.createdAt), { addSuffix: true })}
      </div>
    </Link>
  );
}
