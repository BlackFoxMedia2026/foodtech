export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-secondary" />
          <div className="h-9 w-48 rounded bg-secondary" />
        </div>
        <div className="h-9 w-40 rounded bg-secondary" />
      </div>
      <div className="rounded-lg border bg-background">
        <div className="border-b px-4 py-3">
          <div className="h-4 w-40 rounded bg-secondary" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-secondary" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-secondary" />
                <div className="h-3 w-1/4 rounded bg-secondary/70" />
              </div>
              <div className="h-6 w-16 rounded bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
