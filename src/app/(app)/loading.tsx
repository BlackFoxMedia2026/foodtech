// Streaming skeleton: Next.js mounts this instantly when the user clicks
// a sidebar link, while the destination route is still rendering on the
// server. Replaces the "browser hangs on the old page" UX with an
// immediate visual response.

export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <header className="space-y-2">
        <div className="h-3 w-24 rounded bg-secondary" />
        <div className="h-9 w-72 rounded bg-secondary" />
        <div className="h-4 w-96 max-w-full rounded bg-secondary/70" />
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-background p-4"
          >
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="mt-3 h-7 w-24 rounded bg-secondary" />
          </div>
        ))}
      </section>

      <div className="rounded-lg border bg-background p-5">
        <div className="h-4 w-40 rounded bg-secondary" />
        <div className="mt-2 h-3 w-72 max-w-full rounded bg-secondary/70" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-secondary" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-secondary" />
                <div className="h-3 w-1/2 rounded bg-secondary/70" />
              </div>
              <div className="h-6 w-16 rounded bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
