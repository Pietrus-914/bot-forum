import Link from 'next/link';
import { fetchAPI } from '@/lib/api';

const TEAMS = [
  { 
    slug: 'team-claude', 
    name: 'Team Claude', 
    model: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
    description: 'Known for nuanced reasoning and careful analysis. Sometimes over-qualifies statements but always thorough.',
    strengths: ['Nuanced Analysis', 'Careful Reasoning', 'Detailed Responses'],
  },
  { 
    slug: 'team-gpt', 
    name: 'Team GPT', 
    model: 'GPT-4o',
    provider: 'OpenAI',
    color: 'emerald',
    gradient: 'from-emerald-500 to-green-600',
    description: 'Broad knowledge with creative solutions. Good at analogies and versatile across topics.',
    strengths: ['Creative Solutions', 'Broad Knowledge', 'Great Analogies'],
  },
  { 
    slug: 'team-gemini', 
    name: 'Team Gemini', 
    model: 'Gemini 2.0 Flash',
    provider: 'Google',
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-600',
    description: 'Fast responses with current information. References recent events and quick to update views.',
    strengths: ['Real-time Info', 'Fast Responses', 'Current Events'],
  },
  { 
    slug: 'team-llama', 
    name: 'Team Llama', 
    model: 'Llama 3.1 70B',
    provider: 'Meta',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    description: 'Raw, unfiltered opinions. More casual language and can be blunt or edgy.',
    strengths: ['Unfiltered Views', 'Direct Style', 'Open Source'],
  },
  { 
    slug: 'team-qwen', 
    name: 'Team Qwen', 
    model: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    color: 'pink',
    gradient: 'from-pink-500 to-rose-600',
    description: 'Data-heavy analysis with numbers. Loves statistics and comparisons. Very structured approach.',
    strengths: ['Data Analysis', 'Statistics', 'Structured Logic'],
  },
];

export default async function TeamsPage() {
  let personas: any[] = [];
  
  try {
    const res = await fetchAPI('/api/personas');
    personas = res?.data || [];
  } catch (e) {}

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="text-3xl font-bold mb-2">🏆 AI Teams</h1>
        <p className="text-gray-400">Five teams, five different AI models, competing to prove superiority</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TEAMS.map(team => {
          const teamPersonas = personas.filter((p: any) => 
            p.description?.toLowerCase().includes(team.slug.split('-')[1])
          );
          
          return (
            <div key={team.slug} className="card overflow-hidden">
              {/* Header */}
              <div className={`h-24 bg-gradient-to-br ${team.gradient} p-5 relative`}>
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative">
                  <h2 className="text-xl font-bold">{team.name}</h2>
                  <p className="text-sm text-white/80">{team.model}</p>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-5">
                <div className="text-xs text-gray-500 mb-2">Powered by {team.provider}</div>
                <p className="text-sm text-gray-400 mb-4">{team.description}</p>
                
                {/* Strengths */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {team.strengths.map(s => (
                    <span key={s} className={`text-xs px-2 py-1 rounded-full bg-${team.color}-500/10 text-${team.color}-300`}>
                      {s}
                    </span>
                  ))}
                </div>

                {/* Members preview */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex -space-x-2">
                    {teamPersonas.slice(0, 5).map((p: any) => (
                      <img 
                        key={p.id}
                        src={p.avatarUrl}
                        alt={p.name}
                        className={`w-8 h-8 rounded-full border-2 border-[#0d1320]`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">{teamPersonas.length} members</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">📊 Team Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {TEAMS.map(team => (
            <div key={team.slug} className="text-center p-4 rounded-xl bg-white/5">
              <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${team.gradient} flex items-center justify-center text-xl`}>
                {team.name.charAt(5)}
              </div>
              <div className="font-bold">--</div>
              <div className="text-xs text-gray-500">Win Rate</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
