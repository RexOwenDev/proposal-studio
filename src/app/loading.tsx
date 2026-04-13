/**
 * Dashboard loading skeleton — shown by Next.js during server-side data fetch.
 * Mirrors the real DashboardShell layout so there's no layout shift on load.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="h-5 w-36 bg-gray-200 rounded-md animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Search + filter bar skeleton */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 h-9 bg-white border border-gray-200 rounded-lg animate-pulse shadow-sm" />
          <div className="flex gap-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 w-16 bg-white border border-gray-200 rounded-lg animate-pulse shadow-sm" />
            ))}
          </div>
        </div>

        {/* Proposal card grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <ProposalCardSkeleton key={i} delay={i * 60} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ProposalCardSkeleton({ delay }: { delay: number }) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Title + badge row */}
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
        <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse shrink-0" />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-auto pt-2">
        <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-1 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-1 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Action row */}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <div className="h-6 w-16 bg-gray-100 rounded-md animate-pulse" />
        <div className="h-6 w-14 bg-gray-100 rounded-md animate-pulse" />
      </div>
    </div>
  );
}
