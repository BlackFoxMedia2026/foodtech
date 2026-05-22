import type { TableShape } from "@prisma/client";

export const TABLE_SHAPE_SIZE: Record<TableShape, { w: number; h: number }> = {
  ROUND: { w: 80, h: 80 },
  SQUARE: { w: 80, h: 80 },
  RECT: { w: 120, h: 70 },
  BOOTH: { w: 160, h: 90 },
  LOUNGE: { w: 140, h: 100 },
};

export type TableLiveStatus = "free" | "reserved" | "arrived" | "seated" | "blocked";

export const TABLE_LIVE_TONE: Record<
  TableLiveStatus,
  { bg: string; border: string; text: string; dot: string; label: string }
> = {
  free: {
    bg: "bg-card",
    border: "border-border",
    text: "text-foreground",
    dot: "bg-tertiary",
    label: "Libero",
  },
  reserved: {
    bg: "bg-status-pending-soft",
    border: "border-status-pending/30",
    text: "text-status-pending",
    dot: "bg-status-pending",
    label: "Prenotato",
  },
  arrived: {
    bg: "bg-status-confirmed-soft",
    border: "border-status-confirmed/30",
    text: "text-status-confirmed",
    dot: "bg-status-confirmed",
    label: "Arrivato",
  },
  seated: {
    bg: "bg-status-confirmed-soft",
    border: "border-status-confirmed/40",
    text: "text-status-seated",
    dot: "bg-status-seated",
    label: "Al tavolo",
  },
  blocked: {
    bg: "bg-status-no-show-soft",
    border: "border-status-no-show/30",
    text: "text-status-no-show",
    dot: "bg-status-no-show",
    label: "Bloccato",
  },
};
