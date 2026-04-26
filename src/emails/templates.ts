import { formatDateTime } from "@/lib/utils";
import { type Locale, pickLocale, t } from "@/lib/i18n";

const layoutBase = (locale: Locale, inner: string, footer: string) => `<!doctype html>
<html lang="${locale}">
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
  language?: string | null;
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

function localeOf(guest: GuestLike): Locale {
  return pickLocale(guest.language ?? null);
}

function occasionLabel(locale: Locale, code: string) {
  const key = `email.occasion.${code}` as never;
  const value = t(locale, key);
  // If the key didn't resolve (returned the literal key), fall back to the
  // raw enum so the email isn't broken.
  return value === key ? code : value;
}

export function renderGuestConfirmation(opts: {
  guest: GuestLike;
  venue: VenueLike;
  booking: BookingLike;
}) {
  const { guest, venue, booking } = opts;
  const locale = localeOf(guest);
  const when = formatDateTime(booking.startsAt);
  const inner = `
    <p style="margin:0 0 6px;color:#7a7466;font-size:12px;letter-spacing:.16em;text-transform:uppercase">${escapeHtml(t(locale, "email.confirmation.kicker"))}</p>
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:26px;line-height:1.25">${escapeHtml(t(locale, "email.confirmation.headline", { first: guest.firstName }))}</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55">${t(locale, "email.confirmation.body", { venue: escapeHtml(venue.name) })}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee5cd;border-radius:10px;padding:14px 16px;margin-bottom:18px">
      ${detailRow(t(locale, "email.field.code"), `<span style="font-family:'Menlo',monospace">${fmtRef(booking.reference)}</span>`)}
      ${detailRow(t(locale, "email.field.when"), escapeHtml(when))}
      ${detailRow(t(locale, "email.field.party"), String(booking.partySize))}
      ${booking.occasion ? detailRow(t(locale, "email.field.occasion"), escapeHtml(occasionLabel(locale, booking.occasion))) : ""}
      ${booking.notes ? detailRow(t(locale, "email.field.notes"), escapeHtml(booking.notes)) : ""}
    </table>
    ${
      venue.address || venue.city || venue.phone
        ? `<p style="margin:0 0 8px;font-size:13px;color:#7a7466">${escapeHtml(t(locale, "email.placeLabel"))}</p>
           <p style="margin:0;font-size:14px;line-height:1.5">${[venue.address, venue.city].filter((v): v is string => Boolean(v)).map(escapeHtml).join(" · ")}${venue.phone ? `<br>${escapeHtml(venue.phone)}` : ""}</p>`
        : ""
    }
    ${
      booking.manageUrl
        ? `<p style="margin:18px 0 0"><a href="${booking.manageUrl}" style="display:inline-block;background:#15161a;color:#f7f4ec;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(t(locale, "email.manageButton"))}</a></p>
           <p style="margin:6px 0 0;font-size:12px;color:#7a7466">${escapeHtml(t(locale, "email.manageNote"))}</p>`
        : ""
    }`;
  const footer = t(locale, "email.confirmation.footer", { venue: escapeHtml(venue.name) });
  return {
    subject: t(locale, "email.confirmation.subject", { venue: venue.name, when }),
    html: layoutBase(locale, inner, footer),
    text: t(locale, "email.confirmation.text", {
      first: guest.firstName,
      venue: venue.name,
      when,
      party: booking.partySize,
      code: fmtRef(booking.reference),
    }),
  };
}

export function renderVenueNotification(opts: {
  guest: GuestLike;
  venue: VenueLike;
  booking: BookingLike;
}) {
  const { guest, venue, booking } = opts;
  const locale = localeOf(guest);
  const fullName = [guest.firstName, guest.lastName].filter(Boolean).join(" ");
  const when = formatDateTime(booking.startsAt);
  const inner = `
    <p style="margin:0 0 6px;color:#7a7466;font-size:12px;letter-spacing:.16em;text-transform:uppercase">${escapeHtml(t(locale, "email.venueAlert.kicker"))}</p>
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;line-height:1.25">${escapeHtml(fullName)} · ${booking.partySize} ${escapeHtml(t(locale, "email.field.party").toLowerCase())}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee5cd;border-radius:10px;padding:14px 16px;margin-bottom:14px">
      ${detailRow(t(locale, "email.field.venue"), escapeHtml(venue.name))}
      ${detailRow(t(locale, "email.field.when"), escapeHtml(when))}
      ${detailRow(t(locale, "email.field.code"), `<span style="font-family:'Menlo',monospace">${fmtRef(booking.reference)}</span>`)}
      ${booking.occasion ? detailRow(t(locale, "email.field.occasion"), escapeHtml(occasionLabel(locale, booking.occasion))) : ""}
      ${guest.email ? detailRow(t(locale, "email.field.email"), escapeHtml(guest.email)) : ""}
      ${booking.notes ? detailRow(t(locale, "email.field.notes"), escapeHtml(booking.notes)) : ""}
    </table>
    <p style="margin:0;font-size:13px;color:#7a7466">${escapeHtml(t(locale, "email.venueAlert.cta"))}</p>
  `;
  const footer = t(locale, "email.venueAlert.footer", { venue: escapeHtml(venue.name) });
  return {
    subject: t(locale, "email.venueAlert.subject", {
      name: fullName,
      party: booking.partySize,
      when,
    }),
    html: layoutBase(locale, inner, footer),
    text: t(locale, "email.venueAlert.text", {
      venue: venue.name,
      name: fullName,
      party: booking.partySize,
      when,
      code: fmtRef(booking.reference),
    }),
  };
}

export function renderReminder(opts: {
  guest: GuestLike;
  venue: VenueLike;
  booking: BookingLike;
}) {
  const { guest, venue, booking } = opts;
  const locale = localeOf(guest);
  const when = formatDateTime(booking.startsAt);
  const inner = `
    <p style="margin:0 0 6px;color:#7a7466;font-size:12px;letter-spacing:.16em;text-transform:uppercase">${escapeHtml(t(locale, "email.reminder.kicker"))}</p>
    <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;line-height:1.25">${escapeHtml(t(locale, "email.reminder.headline", { first: guest.firstName }))}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55">${t(locale, "email.reminder.body", { venue: escapeHtml(venue.name) })}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee5cd;border-radius:10px;padding:14px 16px;margin-bottom:14px">
      ${detailRow(t(locale, "email.field.when"), escapeHtml(when))}
      ${detailRow(t(locale, "email.field.party"), String(booking.partySize))}
      ${detailRow(t(locale, "email.field.code"), `<span style="font-family:'Menlo',monospace">${fmtRef(booking.reference)}</span>`)}
    </table>
    <p style="margin:0;font-size:13px;color:#7a7466">${escapeHtml(t(locale, "email.reminder.foot"))}</p>
    ${
      booking.manageUrl
        ? `<p style="margin:14px 0 0"><a href="${booking.manageUrl}" style="color:#15161a">${escapeHtml(t(locale, "email.manageInline"))}</a></p>`
        : ""
    }
  `;
  const footer = t(locale, "email.reminder.footer");
  return {
    subject: t(locale, "email.reminder.subject", { venue: venue.name, when }),
    html: layoutBase(locale, inner, footer),
    text: t(locale, "email.reminder.text", {
      when,
      venue: venue.name,
      party: booking.partySize,
      code: fmtRef(booking.reference),
    }),
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
