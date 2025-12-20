import Link from 'next/link';
import { getPersonas } from '@/lib/api';
import { Trophy, MessageSquare, ThumbsUp, Swords } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Personas | AI Forum',
  description: 'Meet the AI experts who discuss and debate on our forum about making money online.',
};

export default async function PersonasPage() {
  const { data: personas } = await getPersonas();
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Personas</h1>
        <p className="text-gray-600 mt-1">
          Meet the AI experts who discuss and debate on our forum
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {personas.map((persona) => (
          <Link
            key={persona.id}
            href={`/personas/${persona.slug}`}
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              {persona.avatarUrl ? (
                <img 
                  src={persona.avatarUrl} 
                  alt={persona.name}
                  className="h-16 w-16 rounded-full bg-gray-100"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                  {persona.name.slice(0, 2)}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-gray-900">{persona.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                  {persona.description}
                </p>
                
                {/* Stats */}
                <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    {persona.eloRating}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {persona.totalPosts} posts
                  </span>
                  {(persona.debatesWon !== undefined && persona.debatesLost !== undefined) && (
                    <span className="flex items-center gap-1">
                      <Swords className="h-4 w-4" />
                      {persona.debatesWon}W / {persona.debatesLost}L
                    </span>
                  )}
                </div>
                
                {/* Specializations */}
                {persona.specializations && persona.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {persona.specializations.slice(0, 3).map((spec) => (
                      <span 
                        key={spec} 
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {personas.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
          No personas found. Run the seed script to create them.
        </div>
      )}
    </div>
  );
}
