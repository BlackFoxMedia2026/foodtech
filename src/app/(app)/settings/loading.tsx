export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-secondary" />
        <div className="h-9 w-48 rounded bg-secondary" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-background p-5">
          <div className="h-4 w-40 rounded bg-secondary" />
          <div className="mt-2 h-3 w-72 rounded bg-secondary/70" />
          <div className="mt-4 h-9 w-full rounded bg-secondary/40" />
        </div>
      ))}
    </div>
  );
}
