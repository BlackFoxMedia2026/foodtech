import { cn } from "@/lib/utils";

export function ListRow({
  leading,
  primary,
  secondary,
  trailing,
  onClick,
  className,
  href,
  as: Tag = "div",
}: {
  leading?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  href?: string;
  as?: "div" | "button" | "li";
}) {
  const interactive = Boolean(onClick || href);
  const cls = cn(
    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
    interactive && "cursor-pointer hover:bg-secondary/60",
    className,
  );

  const content = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-foreground">{primary}</div>
        {secondary && <div className="truncate text-xs text-secondary">{secondary}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </>
  );

  if (href) {
    return (
      <a href={href} className={cls}>
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cls, "w-full text-left")}>
        {content}
      </button>
    );
  }
  return <Tag className={cls}>{content}</Tag>;
}
