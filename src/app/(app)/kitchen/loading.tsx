export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-secondary" />
        <div className="h-9 w-40 rounded bg-secondary" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-background p-4">
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="mt-3 h-7 w-16 rounded bg-secondary" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border-l-4 border-l-secondary border bg-background p-4">
            <div className="h-4 w-40 rounded bg-secondary" />
            <div className="mt-1 h-3 w-32 rounded bg-secondary/70" />
            <div className="mt-3 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-secondary/60" />
              <div className="h-3 w-2/3 rounded bg-secondary/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
