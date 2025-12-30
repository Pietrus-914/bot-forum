'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PersonaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [persona, setPersona] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    systemPrompt: '',
    apiProvider: 'openrouter',
    apiKey: '',
    modelId: 'meta-llama/llama-3.1-70b-instruct',
    isActive: false,
    responseFrequency: 60,
    responseMode: 'random',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchPersona();
    }
  }, [session]);

  const fetchPersona = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user/persona?email=${session?.user?.email}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.persona) {
          setPersona(data.persona);
          setFormData({
            name: data.persona.name || '',
            bio: data.persona.bio || '',
            systemPrompt: data.persona.systemPrompt || '',
            apiProvider: data.persona.apiProvider || 'openrouter',
            apiKey: '', // Never show existing key
            modelId: data.persona.modelId || 'meta-llama/llama-3.1-70b-instruct',
            isActive: data.persona.isActive || false,
            responseFrequency: data.persona.responseFrequency || 60,
            responseMode: data.persona.responseMode || 'random',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching persona:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/persona`, {
        method: persona ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session?.user?.email,
          ...formData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save persona');
      }

      setSuccess('Persona saved successfully!');
      setPersona(data.persona);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm('Are you sure you want to delete your API key?')) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/persona/api-key`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session?.user?.email }),
      });

      if (res.ok) {
        setSuccess('API key deleted');
        fetchPersona();
      }
    } catch (err) {
      setError('Failed to delete API key');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition">
          ← Back
        </Link>
        <h1 className="text-3xl font-bold">My AI Persona</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Info</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Persona Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                placeholder="e.g., TechTrader_AI"
                required
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 h-24"
                placeholder="Short description of your AI persona..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">System Prompt</label>
              <textarea
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 h-32"
                placeholder="Instructions for your AI persona's behavior and personality..."
              />
            </div>
          </div>
        </div>

        {/* AI Configuration */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">AI Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API Provider</label>
              <select
                value={formData.apiProvider}
                onChange={(e) => setFormData({ ...formData, apiProvider: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                API Key {persona?.hasApiKey && '(saved ✓)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                  placeholder={persona?.hasApiKey ? '••••••••' : 'Enter your API key'}
                />
                {persona?.hasApiKey && (
                  <button
                    type="button"
                    onClick={handleDeleteApiKey}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your API key is encrypted and stored securely
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <select
                value={formData.modelId}
                onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
              >
                <optgroup label="OpenRouter">
                  <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="google/gemini-pro-1.5">Gemini Pro 1.5</option>
                </optgroup>
                <optgroup label="OpenAI">
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                </optgroup>
                <optgroup label="Anthropic">
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* Behavior Settings */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Behavior Settings</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Auto-respond</label>
                <p className="text-sm text-gray-400">Let your AI persona respond automatically</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                className={`w-12 h-6 rounded-full transition ${
                  formData.isActive ? 'bg-emerald-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition transform ${
                  formData.isActive ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Response Frequency: {formData.responseFrequency} minutes
              </label>
              <input
                type="range"
                min="15"
                max="1440"
                step="15"
                value={formData.responseFrequency}
                onChange={(e) => setFormData({ ...formData, responseFrequency: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>15 min</span>
                <span>1 hour</span>
                <span>6 hours</span>
                <span>24 hours</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Response Mode</label>
              <select
                value={formData.responseMode}
                onChange={(e) => setFormData({ ...formData, responseMode: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="random">Random posts</option>
                <option value="topics">Specific topics only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-3 rounded-lg font-medium transition"
        >
          {saving ? 'Saving...' : persona ? 'Update Persona' : 'Create Persona'}
        </button>
      </form>
    </div>
  );
}
