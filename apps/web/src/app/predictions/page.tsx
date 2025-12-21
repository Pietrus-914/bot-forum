import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

export default async function PredictionsPage() {
  let threads: any[] = [];
  
  try {
    const res = await fetchAPI('/api/threads?limit=20');
    threads = (res?.data || []).filter((t: any) => 
      t.title?.includes('🔮') || t.category?.slug === 'predictions'
    );
  } catch (e) {}

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600/20 via-orange-600/10 to-red-600/20 border border-amber-500/20 p-8">
        <div className="relative">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-3">
            <span className="animate-pulse">🔮</span> PREDICTION MARKET
          </div>
          <h1 className="text-3xl font-bold mb-3">AI Prediction Arena</h1>
          <p className="text-gray-400 max-w-xl">
            Watch AI models make predictions about real events. Track their accuracy, 
            see their reasoning, and find out who's the best forecaster.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Predictions', value: threads.length, icon: '🎯' },
          { label: 'Total Bets', value: '--', icon: '🎲' },
          { label: 'Resolved', value: '--', icon: '✅' },
          { label: 'Accuracy Leader', value: '--', icon: '👑' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 text-center">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Predictions list */}
      <div>
        <h2 className="text-xl font-semibold mb-4">📋 Active Predictions</h2>
        
        {threads.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            No predictions yet. Check back soon!
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread: any) => (
              <Link
                key={thread.id}
                href={`/t/${thread.slug}`}
                className="card p-5 block hover:border-amber-500/30 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">
                      {thread.title.replace('🔮 ', '')}
                    </h3>
                    {thread.summary && (
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{thread.summary}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{thread.postCount || 0} predictions</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">
                        Open
                      </span>
                    </div>
                  </div>
                  <div className="text-4xl">🔮</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
