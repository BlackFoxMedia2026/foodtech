/**
 * Calcolo del rischio no-show del singolo ospite.
 *
 * Heuristic ponderato (no ML, ma multi-fattore): combina rate storico,
 * volume di visite, recency dell'ultimo no-show, comportamenti cancellation,
 * loyalty tier come bonus protettivo.
 *
 * Output 0-100 + label IT + tone semantico, riusabile dalla CIC, dalla
 * tabella prenotazioni e dal cockpit.
 */

import type { Guest, Booking } from "@prisma/client";

export type NoShowRisk = {
  score: number;
  label: "Basso" | "Medio" | "Alto" | "Sconosciuto";
  tone: "success" | "warning" | "danger" | "neutral";
  reasons: string[];
};

type RiskInput = {
  guest: Pick<
    Guest,
    | "totalVisits"
    | "noShowCount"
    | "loyaltyTier"
    | "lastVisitAt"
    | "createdAt"
  >;
  /**
   * Storico recente per recency dei no-show (opzionale, max 20 bookings).
   * Per GDPR i record soft-deleted (`deletedAt != null`) NON devono
   * influenzare il risk: vengono filtrati qui in difesa, oltre che dalle
   * query upstream che già applicano `notDeleted`.
   */
  recentBookings?: (Pick<Booking, "status" | "startsAt"> & {
    deletedAt?: Date | null;
  })[];
};

export function computeNoShowRisk({ guest, recentBookings = [] }: RiskInput): NoShowRisk {
  recentBookings = recentBookings.filter((b) => !b.deletedAt);
  const reasons: string[] = [];
  let score = 0;

  // Fattore 1: rate storico no-show (peso 40)
  if (guest.totalVisits === 0) {
    return {
      score: 0,
      label: "Sconosciuto",
      tone: "neutral",
      reasons: ["Nuovo ospite, nessuno storico per stimare il rischio."],
    };
  }
  const rate = guest.noShowCount / Math.max(1, guest.totalVisits);
  const rateScore = Math.min(40, Math.round(rate * 100));
  score += rateScore;
  if (rate > 0) {
    reasons.push(
      `${Math.round(rate * 100)}% no-show storico (${guest.noShowCount} su ${guest.totalVisits} visite)`,
    );
  }

  // Fattore 2: volume basso → meno confidence (peso 15)
  // <3 visite + almeno 1 no-show = alta incertezza → +15
  if (guest.totalVisits < 3 && guest.noShowCount > 0) {
    score += 15;
    reasons.push("Pochi dati storici per essere sicuri");
  }

  // Fattore 3: recency no-show negli ultimi 90gg (peso 25)
  const now = Date.now();
  const recent90 = recentBookings.filter((b) => {
    return now - new Date(b.startsAt).getTime() < 90 * 86400_000;
  });
  const recentNoShow = recent90.filter((b) => b.status === "NO_SHOW").length;
  const recentCancel = recent90.filter((b) => b.status === "CANCELLED").length;
  if (recentNoShow > 0) {
    score += Math.min(25, recentNoShow * 12);
    reasons.push(
      `${recentNoShow} no-show negli ultimi 90 giorni`,
    );
  }
  if (recentCancel >= 2) {
    score += 5;
    reasons.push(`${recentCancel} cancellazioni recenti — pattern di disimpegno`);
  }

  // Fattore 4: assenza prolungata > 9 mesi (peso 10)
  if (guest.lastVisitAt) {
    const monthsSinceLast =
      (now - new Date(guest.lastVisitAt).getTime()) / (30 * 86400_000);
    if (monthsSinceLast >= 9) {
      score += 10;
      reasons.push(
        `Ultima visita più di ${Math.round(monthsSinceLast)} mesi fa — riengagement incerto`,
      );
    }
  }

  // Fattore 5: loyalty come protezione (sottrae rischio)
  if (guest.loyaltyTier === "VIP" || guest.loyaltyTier === "AMBASSADOR") {
    score = Math.max(0, score - 20);
    reasons.push("Tier VIP/Ambassador riduce il rischio percepito");
  } else if (guest.loyaltyTier === "REGULAR" && guest.totalVisits >= 5) {
    score = Math.max(0, score - 8);
    reasons.push("Cliente regolare con storico solido");
  }

  // Cap 0-100
  score = Math.max(0, Math.min(100, score));

  const { label, tone } = bucketize(score);
  return { score, label, tone, reasons };
}

function bucketize(score: number): { label: NoShowRisk["label"]; tone: NoShowRisk["tone"] } {
  if (score >= 55) return { label: "Alto", tone: "danger" };
  if (score >= 25) return { label: "Medio", tone: "warning" };
  return { label: "Basso", tone: "success" };
}
