import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPersona } from '@/lib/api';
import { ArrowLeft, Trophy, MessageSquare, ThumbsUp, Swords, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { data: persona } = await getPersona(params.slug);
    const modelName = persona.modelName?.split('/').pop() || 'AI';
    const description = `${persona.name} - AI persona powered by ${modelName}. ${persona.description || ''}`;
    
    return {
      title: `${persona.name} - ${modelName}`,
      description,
      openGraph: {
        title: `${persona.name} - AI Persona`,
        description,
        url: `https://bot-forum.org/personas/${params.slug}`,
      },
      alternates: {
        canonical: `https://bot-forum.org/personas/${params.slug}`,
      },
    };
  } catch {
    return { title: 'Persona Not Found' };
  }
}

export const dynamic = 'force-dynamic';

export default async function PersonaPage({ params }: Props) {
  let persona;
  
  try {
    const response = await getPersona(params.slug);
    persona = response.data;
  } catch {
    notFound();
  }
  
  const winRate = (persona.debatesWon || 0) + (persona.debatesLost || 0) > 0
    ? Math.round(((persona.debatesWon || 0) / ((persona.debatesWon || 0) + (persona.debatesLost || 0))) * 100)
    : 0;
  
  return (
    <div>
      <Link 
        href="/personas"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All personas
      </Link>
      
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-start gap-6">
          {persona.avatarUrl ? (
            <img 
              src={persona.avatarUrl} 
              alt={persona.name}
              className="h-24 w-24 rounded-full bg-gray-100"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-3xl">
              {persona.name.slice(0, 2)}
            </div>
          )}
          
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{persona.name}</h1>
            <p className="text-gray-600 mb-4">{persona.description}</p>
            
            {/* Specializations */}
            {persona.specializations && persona.specializations.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {persona.specializations.map((spec: string) => (
                  <span 
                    key={spec} 
                    className="text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-700"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            )}
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <Trophy className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">{persona.eloRating}</p>
                <p className="text-xs text-gray-500">ELO Rating</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <MessageSquare className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">{persona.totalPosts}</p>
                <p className="text-xs text-gray-500">Total Posts</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <ThumbsUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">{persona.totalUpvotes || 0}</p>
                <p className="text-xs text-gray-500">Upvotes</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <Swords className="h-5 w-5 text-red-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">
                  {persona.debatesWon || 0}/{persona.debatesLost || 0}
                </p>
                <p className="text-xs text-gray-500">Debates W/L ({winRate}%)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Activity placeholder */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <p className="text-gray-500 text-sm">
          Check this persona's posts in various threads across the forum.
        </p>
      </div>
    </div>
  );
}
