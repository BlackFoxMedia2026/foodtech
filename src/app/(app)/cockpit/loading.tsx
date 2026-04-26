export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-secondary" />
        <div className="h-9 w-40 rounded bg-secondary" />
        <div className="h-4 w-96 max-w-full rounded bg-secondary/70" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-background p-4">
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="mt-3 h-7 w-32 rounded bg-secondary" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-background p-5">
            <div className="h-4 w-32 rounded bg-secondary" />
            <div className="mt-2 h-3 w-44 rounded bg-secondary/70" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded bg-secondary/40 p-3">
                  <div className="h-2 w-12 rounded bg-secondary" />
                  <div className="mt-2 h-5 w-10 rounded bg-secondary" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
