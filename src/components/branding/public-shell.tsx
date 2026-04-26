import { Sparkles } from "lucide-react";

export type PublicBrand = {
  name: string;
  city: string | null;
  logoUrl: string | null;
  accent: string;
  footnote: string | null;
};

export function PublicHeader({
  brand,
  kicker,
}: {
  brand: PublicBrand;
  kicker?: string | null;
}) {
  const accentSoft = `${brand.accent}1a`;
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="h-9 w-9 rounded-md object-contain"
          />
        ) : (
          <span
            className="grid h-9 w-9 place-items-center rounded-md font-display text-base"
            style={{ background: accentSoft, color: brand.accent }}
          >
            {brand.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{brand.name}</p>
          {kicker ? (
            <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: brand.accent }}>
              {kicker}
            </p>
          ) : brand.city ? (
            <p className="text-[11px] text-muted-foreground">{brand.city}</p>
          ) : null}
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Sparkles className="h-3 w-3" /> Tavolo
      </span>
    </header>
  );
}

export function PublicFootnote({ brand }: { brand: PublicBrand }) {
  if (!brand.footnote) {
    return (
      <p className="mt-auto pt-6 text-center text-[10px] text-muted-foreground">
        Powered by Tavolo · {brand.name}
      </p>
    );
  }
  return (
    <p className="mt-auto pt-6 text-center text-[11px] text-muted-foreground">
      {brand.footnote}
    </p>
  );
}

// Inject the venue accent as a CSS variable for inline styling. Use as
// <div style={brandStyles(brand)}>...</div> to enable accent-aware buttons
// without rewriting the design system.
export function brandStyles(brand: PublicBrand): React.CSSProperties {
  return { ["--brand-accent" as string]: brand.accent } as React.CSSProperties;
}
