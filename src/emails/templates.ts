import { formatDateTime } from "@/lib/utils";

const occasionLabel: Record<string, string> = {
  BIRTHDAY: "Compleanno",
  ANNIVERSARY: "Anniversario",
  BUSINESS: "Lavoro",
  DATE: "Romantica",
  CELEBRATION: "Celebrazione",
  OTHER: "Altro",
};

const layoutBase = (inner: string, footer: string) => `<!doctype html>
<html lang="it">
<body style="margin:0;background:#f7f4ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#15161a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ec;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e8e1cf;border-radius:14px;overflow:hidden">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e8e1cf">
          <span style="display:inline-block;width:30px;height:30px;background:#c9a25a;color:#15161a;font-weight:700;border-radius:6px;text-align:center;line-height:30px;font-family:Georgia,serif">T</span>
          <span style="margin-left:10px;font-family:Georgia,serif;font-size:18px">Tavolo</span>
        </td></tr>
        <tr><td style="padding:28px">${inner}</td></tr>
        <tr><td style="padding:18px 28px;background:#fbf8ef;border-top:1px solid #e8e1cf;font-size:12px;color:#7a7466">${footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export type GuestLike = {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
};

export type VenueLike = {
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type BookingLike = {
  reference: string;
  partySize: number;
  startsAt: Date | string;
  occasion?: string | null;
  notes?: string | null;
  manageUrl?: string | null;
};

const fmtRef = (ref: string) => ref.slice(-8).toUpperCase();

const detailRow = (label: string, value: string) => `
<tr>
  <td style="padding:6px 0;color:#7a7466;font-size:13px">${label}</td>
  <td style="padding:6px 0;text-align:right;font-size:14px">${value}</td>
</tr>`;

export function renderGuestConfirmation(opts: {
  guest: GuestLike;
  venue: VenueLike;
  booking: BookingLike;
}) {
  const { guest, venue, booking } = opts;
  const inner = `
    <p style="margin:0 0 6px;color:#7a7466;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Richiesta ricevuta</p>
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:26px;line-height:1.25">Ci siamo quasi, ${escapeHtml(guest.firstName)}.</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55">Abbiamo ricevuto la tua richiesta per <strong>${escapeHtml(venue.name)}</strong>. Il team la conferma a breve. Conserva il codice qui sotto.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee5cd;border-radius:10px;padding:14px 16px;margin-bottom:18px">
      ${detailRow("Codice", `<span style="font-family:'Menlo',monospace">${fmtRef(booking.reference)}</span>`)}
      ${detailRow("Data e ora", escapeHtml(formatDateTime(booking.startsAt)))}
      ${detailRow("Persone", String(booking.partySize))}
      ${booking.occasion ? detailRow("Occasione", escapeHtml(occasionLabel[booking.occasion] ?? booking.occasion)) : ""}
      ${booking.notes ? detailRow("Note", escapeHtml(booking.notes)) : ""}
    </table>
    ${
      venue.address || venue.city || venue.phone
        ? `<p style="margin:0 0 8px;font-size:13px;color:#7a7466">Dove e quando</p>
           <p style="margin:0;font-size:14px;line-height:1.5">${[venue.address, venue.city].filter((v): v is string => Boolean(v)).map(escapeHtml).join(" · ")}${venue.phone ? `<br>${escapeHtml(venue.phone)}` : ""}</p>`
        : ""
    }
    ${
      booking.manageUrl
        ? `<p style="margin:18px 0 0"><a href="${booking.manageUrl}" style="display:inline-block;background:#15161a;color:#f7f4ec;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Gestisci la prenotazione</a></p>
           <p style="margin:6px 0 0;font-size:12px;color:#7a7466">Modifica orario, persone o annulla in autonomia fino a 2 ore prima.</p>`
        : ""
    }`;
  const footer = `Hai ricevuto questa email perché hai prenotato un tavolo presso ${escapeHtml(venue.name)}. Per modifiche o cancellazioni rispondi pure a questo messaggio.`;
  return {
    subject: `Richiesta ricevuta · ${venue.name} · ${formatDateTime(booking.startsAt)}`,
    html: layoutBase(inner, footer),
    text: `Ciao ${guest.firstName}, abbiamo ricevuto la tua richiesta per ${venue.name} il ${formatDateTime(booking.startsAt)} per ${booking.partySize} persone. Codice: ${fmtRef(booking.reference)}.`,
  };
}

export function renderVenueNotification(opts: {
  guest: GuestLike;
  venue: VenueLike;
  booking: BookingLike;
}) {
  const { guest, venue, booking } = opts;
  const fullName = [guest.firstName, guest.lastName].filter(Boolean).join(" ");
  const inner = `
    <p style="margin:0 0 6px;color:#7a7466;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Nuova prenotazione widget</p>
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;line-height:1.25">${escapeHtml(fullName)} · ${booking.partySize} persone</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee5cd;border-radius:10px;padding:14px 16px;margin-bottom:14px">
      ${detailRow("Locale", escapeHtml(venue.name))}
      ${detailRow("Quando", escapeHtml(formatDateTime(booking.startsAt)))}
      ${detailRow("Codice", `<span style="font-family:'Menlo',monospace">${fmtRef(booking.reference)}</span>`)}
      ${booking.occasion ? detailRow("Occasione", escapeHtml(occasionLabel[booking.occasion] ?? booking.occasion)) : ""}
      ${guest.email ? detailRow("Email", escapeHtml(guest.email)) : ""}
      ${booking.notes ? detailRow("Note", escapeHtml(booking.notes)) : ""}
    </table>
    <p style="margin:0;font-size:13px;color:#7a7466">Apri Tavolo per confermare o riassegnare il tavolo.</p>
  `;
  const footer = `Notifica automatica per il team di ${escapeHtml(venue.name)}.`;
  return {
    subject: `🍷 ${fullName} · ${booking.partySize}p · ${formatDateTime(booking.startsAt)}`,
    html: layoutBase(inner, footer),
    text: `Nuova prenotazione widget per ${venue.name}: ${fullName}, ${booking.partySize} persone, ${formatDateTime(booking.startsAt)}. Codice ${fmtRef(booking.reference)}.`,
  };
}

export function renderReminder(opts: {
  guest: GuestLike;
  venue: VenueLike;
  booking: BookingLike;
}) {
  const { guest, venue, booking } = opts;
  const inner = `
    <p style="margin:0 0 6px;color:#7a7466;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Promemoria</p>
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;line-height:1.25">Domani ti aspettiamo, ${escapeHtml(guest.firstName)}.</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55">Un piccolo promemoria per la tua prenotazione presso <strong>${escapeHtml(venue.name)}</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee5cd;border-radius:10px;padding:14px 16px;margin-bottom:14px">
      ${detailRow("Quando", escapeHtml(formatDateTime(booking.startsAt)))}
      ${detailRow("Persone", String(booking.partySize))}
      ${detailRow("Codice", `<span style="font-family:'Menlo',monospace">${fmtRef(booking.reference)}</span>`)}
    </table>
    <p style="margin:0;font-size:13px;color:#7a7466">Se non puoi più venire, scrivici qui e libereremo il tavolo per altri ospiti.</p>
    ${
      booking.manageUrl
        ? `<p style="margin:14px 0 0"><a href="${booking.manageUrl}" style="color:#15161a">Modifica o annulla la prenotazione →</a></p>`
        : ""
    }
  `;
  const footer = `Promemoria automatico inviato 24h prima della prenotazione.`;
  return {
    subject: `Promemoria · ${venue.name} · ${formatDateTime(booking.startsAt)}`,
    html: layoutBase(inner, footer),
    text: `Promemoria: domani ${formatDateTime(booking.startsAt)} hai una prenotazione presso ${venue.name} per ${booking.partySize} persone. Codice ${fmtRef(booking.reference)}.`,
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
