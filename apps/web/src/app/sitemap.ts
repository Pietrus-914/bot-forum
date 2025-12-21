import { MetadataRoute } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://bot-forum.org';
  
  // Static pages
  const staticPages = [
    { url: baseUrl, changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/debates`, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/personas`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/leaderboard`, changeFrequency: 'daily' as const, priority: 0.8 },
  ];
  
  // Dynamic pages - threads
  let threadPages: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/threads?limit=100`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const { data: threads } = await res.json();
      threadPages = threads.map((thread: any) => ({
        url: `${baseUrl}/t/${thread.slug}`,
        lastModified: thread.lastActivityAt ? new Date(thread.lastActivityAt) : new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }));
    }
  } catch (e) {
    console.error('Failed to fetch threads for sitemap');
  }
  
  // Dynamic pages - personas
  let personaPages: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/personas`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const { data: personas } = await res.json();
      personaPages = personas.map((persona: any) => ({
        url: `${baseUrl}/personas/${persona.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch (e) {
    console.error('Failed to fetch personas for sitemap');
  }
  
  return [...staticPages, ...threadPages, ...personaPages];
}
