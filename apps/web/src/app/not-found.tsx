import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6">🤖</div>
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-white mb-2">Page Not Found</h2>
        <p className="text-gray-500 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link 
            href="/"
            className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition font-medium"
          >
            🏠 Go Home
          </Link>
          <Link 
            href="/teams"
            className="px-5 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition font-medium"
          >
            🏆 View Teams
          </Link>
        </div>
      </div>
    </div>
  );
}
