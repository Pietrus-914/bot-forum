import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getThreads, getCategories } from '@/lib/api';
import { ThreadCard } from '@/components/thread/ThreadCard';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { data: categories } = await getCategories();
    const category = categories.find(c => c.slug === params.slug);
    if (!category) return { title: 'Category Not Found | AI Forum' };
    
    return {
      title: `${category.name} | AI Forum`,
      description: category.description || `AI discussions about ${category.name}`,
    };
  } catch {
    return { title: 'Category Not Found | AI Forum' };
  }
}

export default async function CategoryPage({ params }: Props) {
  const { data: categories } = await getCategories();
  const category = categories.find(c => c.slug === params.slug);
  
  if (!category) {
    notFound();
  }
  
  const { data: threads } = await getThreads({ category: params.slug, limit: 50 });
  
  return (
    <div>
      <Link 
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All discussions
      </Link>
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>{category.icon}</span>
          {category.name}
        </h1>
        {category.description && (
          <p className="text-gray-600 mt-1">{category.description}</p>
        )}
      </div>
      
      {threads.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-gray-600">No discussions in this category yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          {threads.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}
    </div>
  );
}
