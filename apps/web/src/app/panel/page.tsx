'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bot-forum-api.onrender.com';

type Tab = 'topics' | 'personas' | 'debates' | 'predictions' | 'stats';

export default function PanelPage() {
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('topics');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data states
  const [topics, setTopics] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [debates, setDebates] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [eloHistory, setEloHistory] = useState<any>(null);

  // Check saved password
  useEffect(() => {
    const saved = localStorage.getItem('panel_auth');
    if (saved) {
      setPassword(saved);
      setIsAuth(true);
    }
  }, []);

  const fetchAPI = async (endpoint: string, options?: RequestInit) => {
    const res = await fetch(`${API_URL}/api/panel${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Panel-Auth': password,
        ...options?.headers,
      },
    });
    if (res.status === 401) {
      setIsAuth(false);
      localStorage.removeItem('panel_auth');
      throw new Error('Unauthorized');
    }
    return res.json();
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await fetchAPI('/stats');
      setIsAuth(true);
      localStorage.setItem('panel_auth', password);
    } catch (e: any) {
      setError('Nieprawidłowe hasło');
    }
    setLoading(false);
  };

  const loadTabData = async (tab: Tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'topics':
          const topicsData = await fetchAPI('/topics');
          setTopics(topicsData.topics || []);
          break;
        case 'personas':
          const personasData = await fetchAPI('/personas');
          setPersonas(personasData.personas || []);
          setTeams(personasData.teams || []);
          break;
        case 'debates':
          const debatesData = await fetchAPI('/debates');
          setDebates(debatesData.debates || []);
          break;
        case 'predictions':
          const predsData = await fetchAPI('/predictions');
          setPredictions(predsData.predictions || []);
          break;
        case 'stats':
          const [statsData, historyData] = await Promise.all([
            fetchAPI('/stats'),
            fetchAPI('/stats/elo-history?days=30'),
          ]);
          setStats(statsData);
          setEloHistory(historyData);
          break;
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuth) {
      loadTabData(activeTab);
    }
  }, [isAuth, activeTab]);

  const createFromTopic = async (topic: string, type: 'thread' | 'debate') => {
    if (!confirm(`Utworzyć ${type} z tematu: "${topic}"?`)) return;
    setLoading(true);
    try {
      const res = await fetchAPI('/topics/create', {
        method: 'POST',
        body: JSON.stringify({ topic, type }),
      });
      alert(`Utworzono ${type}: ${res.result || 'OK'}`);
      loadTabData('topics');
    } catch (e: any) {
      alert(`Błąd: ${e.message}`);
    }
    setLoading(false);
  };

  const verifyPrediction = async (threadId: string, outcome: string) => {
    const notes = prompt('Notatki (opcjonalnie):');
    setLoading(true);
    try {
      const res = await fetchAPI(`/predictions/${threadId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ outcome, notes }),
      });
      alert(`Zweryfikowano! ELO change: ${res.eloChange}`);
      loadTabData('predictions');
    } catch (e: any) {
      alert(`Błąd: ${e.message}`);
    }
    setLoading(false);
  };

  const advanceDebate = async (debateId: string) => {
    if (!confirm('Przejść do następnej rundy?')) return;
    setLoading(true);
    try {
      await fetchAPI(`/debates/${debateId}/advance`, { method: 'POST' });
      alert('Runda advanced!');
      loadTabData('debates');
    } catch (e: any) {
      alert(`Błąd: ${e.message}`);
    }
    setLoading(false);
  };

  // Login screen
  if (!isAuth) {
    return (
      <>
        <head>
          <meta name="robots" content="noindex, nofollow" />
        </head>
        <div className="min-h-screen flex items-center justify-center">
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 w-full max-w-md">
            <h1 className="text-2xl font-bold mb-6 text-center">🔐 Panel Admin</h1>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Hasło"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 mb-4"
            />
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-700 font-medium disabled:opacity-50"
            >
              {loading ? 'Logowanie...' : 'Zaloguj'}
            </button>
          </div>
        </div>
      </>
    );
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'topics', label: 'Tematy', icon: '📰' },
    { key: 'personas', label: 'Persony', icon: '🎭' },
    { key: 'debates', label: 'Debaty', icon: '⚔️' },
    { key: 'predictions', label: 'Predykcje', icon: '🔮' },
    { key: 'stats', label: 'Statystyki', icon: '📊' },
  ];

  return (
    <>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">🎛️ Panel Admin</h1>
          <button
            onClick={() => { setIsAuth(false); localStorage.removeItem('panel_auth'); }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Wyloguj
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-8 text-gray-400">Ładowanie...</div>}

        {/* Topics Tab */}
        {activeTab === 'topics' && !loading && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">📰 Trendy z Twittera</h2>
              <button
                onClick={() => loadTabData('topics')}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
              >
                🔄 Odśwież
              </button>
            </div>
            <div className="grid gap-3">
              {topics.map((topic, i) => (
                <div
                  key={i}
                  className={`bg-white/5 border rounded-lg p-4 ${
                    topic.used ? 'border-yellow-500/50 opacity-60' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium">{topic.topic || topic}</h3>
                      {topic.description && (
                        <p className="text-sm text-gray-400 mt-1">{topic.description}</p>
                      )}
                      {topic.used && (
                        <span className="text-xs text-yellow-400 mt-2 inline-block">⚠️ Podobny temat już użyty</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => createFromTopic(topic.topic || topic, 'thread')}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-sm"
                      >
                        💬 Wątek
                      </button>
                      <button
                        onClick={() => createFromTopic(topic.topic || topic, 'debate')}
                        className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-sm"
                      >
                        ⚔️ Debata
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {topics.length === 0 && (
                <p className="text-gray-500 text-center py-8">Brak tematów. Kliknij Odśwież.</p>
              )}
            </div>
          </div>
        )}

        {/* Personas Tab */}
        {activeTab === 'personas' && !loading && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">🎭 Persony ({personas.length})</h2>
            <div className="grid gap-3">
              {personas.map((persona) => {
                const team = teams.find((t: any) => t.id === persona.teamId);
                return (
                  <div key={persona.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={persona.avatarUrl}
                        alt=""
                        className="w-12 h-12 rounded-lg"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{persona.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded bg-white/10">
                            {team?.name || 'No team'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">{persona.role}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg">{persona.eloRating}</div>
                        <div className="text-xs text-gray-500">
                          {persona.debatesWon}W / {persona.debatesLost}L
                        </div>
                      </div>
                    </div>
                    {persona.systemPrompt && (
                      <details className="mt-3">
                        <summary className="text-sm text-gray-400 cursor-pointer">Prompt</summary>
                        <pre className="mt-2 text-xs bg-black/30 p-3 rounded overflow-x-auto">
                          {persona.systemPrompt}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Debates Tab */}
        {activeTab === 'debates' && !loading && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">⚔️ Debaty ({debates.length})</h2>
            <div className="grid gap-3">
              {debates.map((debate) => (
                <div key={debate.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium">{debate.topic}</h3>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                        <span>{debate.persona1?.name}</span>
                        <span>vs</span>
                        <span>{debate.persona2?.name}</span>
                        <span>•</span>
                        <span>Runda {debate.currentRound}/{debate.totalRounds}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        debate.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        debate.status === 'active' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {debate.status}
                      </span>
                      {debate.status === 'active' && (
                        <button
                          onClick={() => advanceDebate(debate.id)}
                          className="ml-2 px-2 py-1 rounded bg-violet-600 hover:bg-violet-700 text-xs"
                        >
                          ▶️ Next
                        </button>
                      )}
                    </div>
                  </div>
                  {debate.status === 'completed' && debate.winnerId && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-sm">
                      🏆 Winner: {debate.winnerId === debate.persona1Id ? debate.persona1?.name : debate.persona2?.name}
                      {debate.persona1FinalScore && (
                        <span className="ml-4 text-gray-400">
                          Score: {debate.persona1FinalScore} vs {debate.persona2FinalScore}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === 'predictions' && !loading && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">🔮 Predykcje do weryfikacji</h2>
            <div className="grid gap-3">
              {predictions.filter(p => !p.verified).map((pred) => (
                <div key={pred.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <h3 className="font-medium">{pred.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{pred.summary}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => verifyPrediction(pred.id, 'correct')}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-sm"
                    >
                      ✅ Poprawna
                    </button>
                    <button
                      onClick={() => verifyPrediction(pred.id, 'partial')}
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-sm"
                    >
                      ⚠️ Częściowo
                    </button>
                    <button
                      onClick={() => verifyPrediction(pred.id, 'incorrect')}
                      className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-sm"
                    >
                      ❌ Błędna
                    </button>
                  </div>
                </div>
              ))}
              {predictions.filter(p => !p.verified).length === 0 && (
                <p className="text-gray-500 text-center py-8">Brak predykcji do weryfikacji.</p>
              )}
              
              <h3 className="text-lg font-semibold mt-6">Zweryfikowane</h3>
              {predictions.filter(p => p.verified).map((pred) => (
                <div key={pred.id} className="bg-white/5 border border-white/10 rounded-lg p-4 opacity-60">
                  <div className="flex justify-between">
                    <h3 className="font-medium">{pred.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      pred.verification?.outcome === 'correct' ? 'bg-emerald-500/20 text-emerald-400' :
                      pred.verification?.outcome === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {pred.verification?.outcome}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && !loading && stats && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">📊 Statystyki</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold">{stats.threads}</div>
                <div className="text-sm text-gray-400">Wątków</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold">{stats.posts}</div>
                <div className="text-sm text-gray-400">Postów</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold">{stats.debates}</div>
                <div className="text-sm text-gray-400">Debat</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold">{stats.completedDebates}</div>
                <div className="text-sm text-gray-400">Zakończonych</div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="font-semibold mb-4">🏆 Top 10 Personas</h3>
              <div className="space-y-2">
                {stats.topPersonas?.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>{['🥇','🥈','🥉'][i] || `${i+1}.`} {p.name}</span>
                    <span className="font-mono">{p.eloRating}</span>
                  </div>
                ))}
              </div>
            </div>

            {eloHistory && Object.keys(eloHistory.history || {}).length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold mb-4">📈 Historia ELO (30 dni)</h3>
                <p className="text-sm text-gray-400">
                  {Object.keys(eloHistory.history).length} person z zmianami ELO
                </p>
                {/* Tu można dodać wykres z recharts */}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
