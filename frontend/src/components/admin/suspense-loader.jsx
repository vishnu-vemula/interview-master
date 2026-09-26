/**
 * SuspenseLoader — skeleton shown while a lazy admin page chunk loads.
 */

export default function SuspenseLoader({ fullScreen = false }) {
  const body = (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-9 w-64" />
        </div>
        <div className="skeleton h-10 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-4 p-5">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="card space-y-4 p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton hidden h-4 flex-1 sm:block" />
            <div className="skeleton h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );

  if (!fullScreen) return body;
  return <div className="min-h-dvh bg-paper px-4 py-10 sm:px-8"><div className="mx-auto max-w-[1100px]">{body}</div></div>;
}
