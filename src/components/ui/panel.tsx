import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn("panel", className)}>{children}</section>;
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-3 px-5 pb-3 pt-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-display text-base font-medium tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}
