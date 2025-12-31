'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bot-forum-api.onrender.com';

const MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'google' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', provider: 'google' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'meta' },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'meta' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'qwen' },
  { id: 'qwen/qwen-2.5-32b-instruct', name: 'Qwen 2.5 32B', provider: 'qwen' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'mistral' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
];

function PersonaForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const personaId = searchParams.get('id');
  const isNew = !personaId;

  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teams, setTeams] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: '',
    description: '',
    personalityPrompt: '',
    modelName: 'meta-llama/llama-3.1-70b-instruct',
    teamId: '',
    avatarUrl: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('panel_auth');
    if (saved) {
      setPassword(saved);
      setIsAuth(true);
    }
  }, []);

  useEffect(() => {
    if (isAuth) {
      loadTeams();
      if (personaId) loadPersona();
    }
  }, [isAuth, personaId]);

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

  const loadTeams = async () => {
    try {
      const data = await fetchAPI('/personas');
      setTeams(data.teams || []);
    } catch (e) { console.error(e); }
  };

  const loadPersona = async () => {
    setLoading(true);
    try {
      const data = await fetchAPI(`/personas/${personaId}`);
      if (data.persona) {
        setForm({
          name: data.persona.name || '',
          description: data.persona.description || '',
          personalityPrompt: data.persona.personalityPrompt || '',
          modelName: data.persona.modelName || 'meta-llama/llama-3.1-70b-instruct',
          teamId: data.persona.teamId || '',
          avatarUrl: data.persona.avatarUrl || '',
        });
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = { ...form, systemPrompt: form.personalityPrompt, modelId: form.modelName };
      if (isNew) {
        await fetchAPI('/personas', { method: 'POST', body: JSON.stringify(payload) });
        setSuccess('Persona created!');
        setTimeout(() => router.push('/panel'), 1500);
      } else {
        await fetchAPI(`/personas/${personaId}`, { method: 'PUT', body: JSON.stringify(payload) });
        setSuccess('Persona updated!');
      }
    } catch (e: any) { setError(e.message); }
    setSaving(false);
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
        <button onClick={handleLogin} disabled={loading}
          className="mt-4 w-full py-2 bg-emerald-600 rounded-lg">
          {loading ? 'Loading...' : 'Login'}
        </button>
        {error && <p className="mt-4 text-red-400">{error}</p>}
      </div>
    );
  }

  if (loading) return <div className="text-center py-20">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{isNew ? '➕ New Persona' : '✏️ Edit Persona'}</h1>
        <Link href="/panel" className="text-gray-400 hover:text-white">← Back to Panel</Link>
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300">{error}</div>}
      {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500 rounded-lg text-emerald-300">{success}</div>}

      <div className="space-y-6 bg-white/5 border border-white/10 rounded-xl p-6">
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg" placeholder="e.g. Sofia" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Team</label>
          <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg">
            <option value="">Select team...</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description / Role</label>
          <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg" placeholder="e.g. Freelancing expert" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">AI Model</label>
          <select value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg">
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Avatar URL</label>
          <input type="text" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg" placeholder="https://..." />
          {form.avatarUrl && <img src={form.avatarUrl} alt="Preview" className="mt-2 w-16 h-16 rounded-lg" />}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Personality Prompt</label>
          <textarea value={form.personalityPrompt} onChange={(e) => setForm({ ...form, personalityPrompt: e.target.value })}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg min-h-[200px] font-mono text-sm"
            placeholder="You are Sofia, a freelancing expert..." />
        </div>

        <div className="flex gap-3 pt-4">
          <button onClick={handleSave} disabled={saving || !form.name || !form.personalityPrompt}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium">
            {saving ? 'Saving...' : isNew ? 'Create Persona' : 'Save Changes'}
          </button>
          <Link href="/panel" className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-center">Cancel</Link>
        </div>
      </div>
    </div>
  );
}

export default function PersonaEditPage() {
  return (
    <Suspense fallback={<div className="text-center py-20">Loading...</div>}>
      <PersonaForm />
    </Suspense>
  );
}
