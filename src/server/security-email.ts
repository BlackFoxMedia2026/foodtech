import { db } from "@/lib/db";
import { dispatchMessage } from "@/server/messages";
import { logAudit } from "@/server/audit";
import { captureError } from "@/lib/observability";

// Eventi di sicurezza che notifichiamo via email all'utente. Sono separati dalle
// notifiche in-app (notifications.ts, venue-scoped, NotificationKind enum) perché
// targetano la persona fisica indipendentemente dal venue attivo. Lo scopo è
// fornire un canale out-of-band quando il device 2FA è perso o quando l'account
// viene compromesso: l'email arriva all'inbox che l'utente controlla sul
// secondo device.
export type SecurityEmailKind =
  | "2fa.recovery_code.used"
  | "2fa.disabled"
  | "2fa.recovery_codes.regenerate";

export type SendUserSecurityEmailInput = {
  userId: string;
  kind: SecurityEmailKind;
  metadata?: {
    ip?: string | null;
    userAgent?: string | null;
    remaining?: number;
  };
};

const SETTINGS_URL = "/settings#security";

function formatTimestamp(d: Date): string {
  // Stile italiano corto: "08/06/2026, 14:32 (UTC)". Manteniamo UTC per
  // evitare ambiguità tra timezone server/utente.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())} (UTC)`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type EmailTemplate = { subject: string; html: string; text: string };

function buildTemplate(
  kind: SecurityEmailKind,
  now: Date,
  metadata: SendUserSecurityEmailInput["metadata"],
): EmailTemplate {
  const ts = formatTimestamp(now);
  const ip = metadata?.ip ? escapeHtml(metadata.ip) : "sconosciuto";
  const remaining = metadata?.remaining;
  const settingsLink = `<a href="${SETTINGS_URL}">${SETTINGS_URL}</a>`;

  switch (kind) {
    case "2fa.recovery_code.used": {
      const remainingLabel = typeof remaining === "number" ? `${remaining}/10` : "—";
      const subject = "Codice di recupero utilizzato";
      const text =
        `Hai effettuato l'accesso a Tavolo con un codice di recupero alle ${ts} da IP ${ip}. ` +
        `Restano ${remainingLabel} codici. Se non sei stato tu, cambia la password immediatamente.\n\n` +
        `Gestisci la sicurezza: ${SETTINGS_URL}`;
      const html =
        `<p>Hai effettuato l'accesso a <strong>Tavolo</strong> con un <strong>codice di recupero</strong> alle ${ts} da IP <code>${ip}</code>.</p>` +
        `<p>Restano <strong>${remainingLabel}</strong> codici. Se non sei stato tu, <strong>cambia la password immediatamente</strong> e rigenera i recovery codes.</p>` +
        `<p>${settingsLink}</p>`;
      return { subject, html, text };
    }
    case "2fa.disabled": {
      const subject = "Autenticazione a due fattori disabilitata";
      const text =
        `La 2FA è stata disabilitata sul tuo account il ${ts}. ` +
        `Se non sei stato tu, riabilita la 2FA immediatamente e cambia la password.\n\n` +
        `Gestisci la sicurezza: ${SETTINGS_URL}`;
      const html =
        `<p>La <strong>2FA</strong> è stata disabilitata sul tuo account il ${ts}.</p>` +
        `<p>Se non sei stato tu, <strong>riabilita la 2FA immediatamente</strong> e cambia la password.</p>` +
        `<p>${settingsLink}</p>`;
      return { subject, html, text };
    }
    case "2fa.recovery_codes.regenerate": {
      const subject = "Nuovi codici di recupero generati";
      const text =
        `Hai generato un nuovo set di 10 codici di recupero il ${ts}. ` +
        `I codici precedenti sono ora invalidi. Conserva i nuovi codici in un luogo sicuro.\n\n` +
        `Gestisci la sicurezza: ${SETTINGS_URL}`;
      const html =
        `<p>Hai generato un nuovo set di <strong>10 codici di recupero</strong> il ${ts}.</p>` +
        `<p>I codici precedenti sono ora <strong>invalidi</strong>. Conserva i nuovi codici in un luogo sicuro.</p>` +
        `<p>${settingsLink}</p>`;
      return { subject, html, text };
    }
  }
}

/**
 * Invia un'email di sicurezza all'utente per eventi 2FA critici.
 *
 * - Carica `User.email` e `User.venueMemberships` (per il venueId richiesto da
 *   `dispatchMessage` → MessageLog). Se l'utente non ha email registrata
 *   ritorna silenzioso (niente errore, niente audit).
 * - Costruisce subject + body HTML/text dal template per il `kind`.
 * - Catch silenzioso: un fallimento dell'invio non deve mai bloccare il flow
 *   security primario (login con recovery, disable 2FA, regenerate).
 * - Logga audit `email.security.sent` (status SENT/SKIPPED/FAILED) dopo il
 *   dispatch, così la timeline di sicurezza include la notifica out-of-band.
 */
export async function sendUserSecurityEmail(
  params: SendUserSecurityEmailInput,
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: {
        email: true,
        venueMemberships: {
          select: { venueId: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        orgMemberships: {
          select: { orgId: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    // No email = no-op silent. Stesso comportamento se non c'è venueMembership
    // (MessageLog richiede venueId not-null): per utenti in limbo (OAuth pre-
    // invito) saltiamo il dispatch ma non logghiamo errore.
    if (!user?.email) return;
    const venueId = user.venueMemberships[0]?.venueId;
    if (!venueId) return;

    const tpl = buildTemplate(params.kind, new Date(), params.metadata);
    const messageLogId = await dispatchMessage({
      venueId,
      channel: "EMAIL",
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });

    // Recuperiamo lo status finale del MessageLog per loggarlo nell'audit
    // (SENT se il provider Resend ha accettato, SKIPPED se RESEND_API_KEY
    // manca, FAILED altrimenti). Letture in più non rompono il flow: siamo
    // già in catch silenzioso esterno.
    const log = await db.messageLog.findUnique({
      where: { id: messageLogId },
      select: { status: true },
    });

    const orgId = user.orgMemberships[0]?.orgId;
    if (orgId) {
      await logAudit({
        orgId,
        actorId: params.userId,
        actorEmail: user.email,
        action: "email.security.sent",
        entityType: "User",
        entityId: params.userId,
        diff: {
          kind: params.kind,
          deliveryStatus: log?.status ?? "UNKNOWN",
        },
      });
    }
  } catch (err) {
    // Catch silenzioso: il flow security NON si blocca per un'email mancata.
    captureError(err, {
      module: "security-email",
      extra: { kind: params.kind, userId: params.userId },
    });
    console.warn("[security-email] dispatch failed", err);
  }
}
