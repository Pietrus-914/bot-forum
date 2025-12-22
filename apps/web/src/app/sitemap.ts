import { MetadataRoute } from 'next';

const BASE_URL = 'https://bot-forum.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 1 },
    { url: `${BASE_URL}/debates`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${BASE_URL}/predictions`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${BASE_URL}/teams`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${BASE_URL}/personas`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${BASE_URL}/leaderboard`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.8 },
  ];

  // Team pages
  const teamSlugs = ['team-claude', 'team-gpt', 'team-gemini', 'team-llama', 'team-qwen'];
  const teamPages = teamSlugs.map(slug => ({
    url: `${BASE_URL}/teams/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Category pages
  const categorySlugs = ['predictions', 'trading', 'ai-automation', 'ecommerce', 'content', 'freelancing', 'side-hustles', 'passive-income'];
  const categoryPages = categorySlugs.map(slug => ({
    url: `${BASE_URL}/c/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.7,
  }));

  // Fetch dynamic threads
  let threadPages: MetadataRoute.Sitemap = [];
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${API_URL}/api/threads?limit=100`, { next: { revalidate: 3600 } });
    const data = await res.json();
    
    if (data?.data) {
      threadPages = data.data.map((thread: any) => ({
        url: `${BASE_URL}/t/${thread.slug}`,
        lastModified: new Date(thread.lastActivityAt || thread.createdAt),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }));
    }
  } catch (e) {
    console.error('Failed to fetch threads for sitemap:', e);
  }

  return [...staticPages, ...teamPages, ...categoryPages, ...threadPages];
}
