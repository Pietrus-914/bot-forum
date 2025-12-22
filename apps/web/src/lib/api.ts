const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchAPI<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    next: { revalidate: 60 },
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }
  
  return res.json();
}

// Types
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  threadCount: number;
}

export interface Persona {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  description: string | null;
  specializations: string[];
  eloRating: number;
  totalPosts: number;
  totalUpvotes?: number;
  debatesWon?: number;
  debatesLost?: number;
}

export interface Thread {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  postCount: number;
  upvotes: number;
  viewCount: number;
  isDebate: boolean;
  debateId: string | null;
  isPinned: boolean;
  createdAt: string;
  lastActivityAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  };
  starterPersona: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
  };
}

export interface Post {
  id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  isBestAnswer: boolean;
  createdAt: string;
  persona: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    eloRating: number;
  };
}

export interface Debate {
  id: string;
  topic: string;
  description: string | null;
  status: string;
  totalRounds: number;
  currentRound: number;
  persona1Votes: number;
  persona2Votes: number;
  eloChange: number;
  createdAt: string;
  completedAt: string | null;
  threadId: string | null;
  persona1: Persona;
  persona2: Persona;
}

// API Functions
export const getCategories = () => 
  fetchAPI<{ data: Category[] }>('/api/categories');

export const getThreads = (params?: { 
  category?: string; 
  page?: number;
  limit?: number;
  debates?: boolean;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.debates) searchParams.set('debates', 'true');
  
  const query = searchParams.toString();
  return fetchAPI<{ data: Thread[]; pagination: any }>(
    `/api/threads${query ? `?${query}` : ''}`
  );
};

export const getThread = (slug: string) =>
  fetchAPI<{ thread: Thread; posts: Post[] }>(`/api/threads/${slug}`);

export const getPersonas = () =>
  fetchAPI<{ data: Persona[] }>('/api/personas');

export const getPersona = (slug: string) =>
  fetchAPI<{ data: Persona }>(`/api/personas/${slug}`);

export const getDebates = (status?: string) => {
  const params = status ? `?status=${status}` : '';
  return fetchAPI<{ data: Debate[] }>(`/api/debates${params}`);
};

export const getDebate = (id: string) =>
  fetchAPI<{ 
    debate: any; 
    persona1: Persona; 
    persona2: Persona; 
    rounds: any[];
    thread: { slug: string } | null;
  }>(`/api/debates/${id}`);

export const vote = (data: {
  visitorId: string;
  votableType: 'post' | 'debate';
  votableId: string;
  value: number;
  votedPersonaId?: string;
}) => fetchAPI<{ success: boolean }>('/api/votes', { 
  method: 'POST', 
  body: JSON.stringify(data) 
});

export const checkVote = (params: {
  visitorId: string;
  votableType: string;
  votableId: string;
}) => {
  const searchParams = new URLSearchParams(params);
  return fetchAPI<{ voted: boolean; value: number; votedPersonaId: string | null }>(
    `/api/votes/check?${searchParams}`
  );
};

export const voteDebate = (debateId: string, data: {
  visitorId: string;
  personaId: string;
}) => fetchAPI<{ success: boolean }>(`/api/debates/${debateId}/vote`, {
  method: 'POST',
  body: JSON.stringify(data),
});
