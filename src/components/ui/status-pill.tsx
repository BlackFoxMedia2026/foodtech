import { cn } from "@/lib/utils";

export type BookingStatusKey =
  | "CONFIRMED"
  | "PENDING"
  | "ARRIVED"
  | "SEATED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

const BOOKING_STATUS: Record<
  BookingStatusKey,
  { label: string; classes: string }
> = {
  CONFIRMED: { label: "Confermata", classes: "bg-status-confirmed-soft text-status-confirmed" },
  PENDING: { label: "In attesa", classes: "bg-status-pending-soft text-status-pending" },
  ARRIVED: { label: "Arrivato", classes: "bg-status-confirmed-soft text-status-arrived" },
  SEATED: { label: "Al tavolo", classes: "bg-status-confirmed-soft text-status-seated" },
  COMPLETED: { label: "Completata", classes: "bg-secondary text-foreground" },
  CANCELLED: { label: "Annullata", classes: "bg-secondary text-status-cancelled" },
  NO_SHOW: { label: "No-show", classes: "bg-status-no-show-soft text-status-no-show" },
};

export type LoyaltyKey = "NEW" | "REGULAR" | "VIP" | "AMBASSADOR";

const LOYALTY: Record<LoyaltyKey, { label: string; classes: string }> = {
  NEW: { label: "Nuovo", classes: "bg-secondary text-secondary" },
  REGULAR: { label: "Regolare", classes: "bg-secondary text-foreground" },
  VIP: { label: "VIP", classes: "bg-status-vip-soft text-status-vip" },
  AMBASSADOR: { label: "Ambassador", classes: "bg-status-vip-soft text-status-vip" },
};

export function StatusPill({
  status,
  size = "sm",
  className,
}: {
  status: BookingStatusKey;
  size?: "xs" | "sm";
  className?: string;
}) {
  const meta = BOOKING_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "xs" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-0.5 text-xs",
        meta.classes,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

export function LoyaltyPill({
  loyalty,
  className,
}: {
  loyalty: LoyaltyKey;
  className?: string;
}) {
  const meta = LOYALTY[loyalty];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.classes,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
