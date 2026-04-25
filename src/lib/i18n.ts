export const SUPPORTED_LOCALES = ["it", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "it";

const dictionaries = {
  it: {
    "widget.brand": "Tavolo · prenotazione online",
    "widget.book": "Prenota",
    "widget.party": "Persone",
    "widget.party.singular": "persona",
    "widget.party.plural": "persone",
    "widget.date": "Data",
    "widget.time": "Orario",
    "widget.loadingSlots": "carico disponibilità…",
    "widget.noSlots": "Nessun orario disponibile per il giorno selezionato.",
    "widget.summary":
      "Stai prenotando da {venue} il {date} alle {time} per {party}.",
    "widget.modify": "Modifica",
    "widget.firstName": "Nome",
    "widget.lastName": "Cognome",
    "widget.email": "Email",
    "widget.phone": "Telefono",
    "widget.occasion": "Occasione (opzionale)",
    "widget.occasion.none": "Nessuna",
    "widget.occasion.BIRTHDAY": "Compleanno",
    "widget.occasion.ANNIVERSARY": "Anniversario",
    "widget.occasion.BUSINESS": "Lavoro",
    "widget.occasion.DATE": "Romantica",
    "widget.occasion.CELEBRATION": "Celebrazione",
    "widget.occasion.OTHER": "Altro",
    "widget.notes": "Note (allergie, preferenze)",
    "widget.optIn": "Voglio ricevere comunicazioni e proposte da {venue}.",
    "widget.back": "Indietro",
    "widget.submit": "Conferma prenotazione",
    "widget.submit.deposit": "Vai al pagamento · {amount}",
    "widget.submitting": "Invio…",
    "widget.deposit.title": "Caparra richiesta",
    "widget.deposit.copy":
      "Per gruppi da {threshold}+ persone è richiesta una caparra di {total} ({each} a persona). Verrai indirizzato al pagamento sicuro al click su Conferma.",
    "widget.deposit.foot":
      "Per gruppi da {threshold}+ persone è richiesta una caparra di {each} a persona, addebitata in modo sicuro al momento della conferma.",
    "widget.poweredBy": "Powered by",
    "widget.secureBooking": "prenotazione sicura",
    "widget.kind.RESTAURANT": "Ristorante",
    "widget.kind.BEACH_CLUB": "Beach club",
    "widget.kind.BAR": "Bar / cocktail",
    "widget.kind.HOTEL_RESTAURANT": "Hotel restaurant",
    "widget.kind.PRIVATE_CLUB": "Private club",
    "widget.kind.OTHER": "Locale",
    "widget.error.slot_unavailable": "L'orario selezionato non è più disponibile, scegli un altro slot.",
    "widget.error.outside_service": "Quell'orario è fuori dai turni del locale.",
    "widget.error.invalid_datetime": "Data o ora non valide.",
    "widget.error.venue_not_found": "Locale non trovato.",
    "widget.error.invalid_input": "Controlla i dati inseriti.",
    "widget.error.invalid_json": "Invio non riuscito, riprova.",
    "widget.error.generic": "Impossibile completare la prenotazione.",
    "done.requestSent": "Richiesta inviata",
    "done.confirmed": "Prenotazione confermata",
    "done.failed": "Pagamento non riuscito",
    "done.headline.requested": "Grazie {first}, ci siamo quasi.",
    "done.headline.held": "Grazie {first}, prenotazione confermata.",
    "done.headline.failed": "Caparra non confermata",
    "done.sub.requested":
      "Il team di {venue} conferma la richiesta a breve. Riceverai un'email con tutti i dettagli.",
    "done.sub.held": "La caparra è stata trattenuta. Il tavolo presso {venue} ti aspetta.",
    "done.sub.failed":
      "Il pagamento della caparra non è andato a buon fine. Puoi riprovare o contattare il locale.",
    "done.code": "Codice",
    "done.when": "Data e ora",
    "done.party": "Persone",
    "done.deposit": "Caparra",
    "done.depositHeld": "trattenuta",
    "done.depositFailed": "non riuscita",
    "done.newBooking": "Nuova prenotazione",
  },
  en: {
    "widget.brand": "Tavolo · online booking",
    "widget.book": "Book",
    "widget.party": "Guests",
    "widget.party.singular": "guest",
    "widget.party.plural": "guests",
    "widget.date": "Date",
    "widget.time": "Time",
    "widget.loadingSlots": "loading availability…",
    "widget.noSlots": "No times available on the selected day.",
    "widget.summary":
      "You're booking at {venue} on {date} at {time} for {party}.",
    "widget.modify": "Edit",
    "widget.firstName": "First name",
    "widget.lastName": "Last name",
    "widget.email": "Email",
    "widget.phone": "Phone",
    "widget.occasion": "Occasion (optional)",
    "widget.occasion.none": "None",
    "widget.occasion.BIRTHDAY": "Birthday",
    "widget.occasion.ANNIVERSARY": "Anniversary",
    "widget.occasion.BUSINESS": "Business",
    "widget.occasion.DATE": "Date night",
    "widget.occasion.CELEBRATION": "Celebration",
    "widget.occasion.OTHER": "Other",
    "widget.notes": "Notes (allergies, preferences)",
    "widget.optIn": "Subscribe me to news and offers from {venue}.",
    "widget.back": "Back",
    "widget.submit": "Confirm booking",
    "widget.submit.deposit": "Go to payment · {amount}",
    "widget.submitting": "Sending…",
    "widget.deposit.title": "Deposit required",
    "widget.deposit.copy":
      "For parties of {threshold}+ a deposit of {total} ({each} per person) is required. You'll be redirected to secure checkout once you confirm.",
    "widget.deposit.foot":
      "For parties of {threshold}+ a {each} per-person deposit is charged securely at confirmation.",
    "widget.poweredBy": "Powered by",
    "widget.secureBooking": "secure booking",
    "widget.kind.RESTAURANT": "Restaurant",
    "widget.kind.BEACH_CLUB": "Beach club",
    "widget.kind.BAR": "Bar / cocktail",
    "widget.kind.HOTEL_RESTAURANT": "Hotel restaurant",
    "widget.kind.PRIVATE_CLUB": "Private club",
    "widget.kind.OTHER": "Venue",
    "widget.error.slot_unavailable": "That time slot is no longer available, please pick another.",
    "widget.error.outside_service": "That time is outside our service hours.",
    "widget.error.invalid_datetime": "Invalid date or time.",
    "widget.error.venue_not_found": "Venue not found.",
    "widget.error.invalid_input": "Please check the form fields.",
    "widget.error.invalid_json": "Submission failed, please retry.",
    "widget.error.generic": "Unable to complete the booking.",
    "done.requestSent": "Request sent",
    "done.confirmed": "Booking confirmed",
    "done.failed": "Payment failed",
    "done.headline.requested": "Thanks {first}, almost done.",
    "done.headline.held": "Thanks {first}, you're confirmed.",
    "done.headline.failed": "Deposit not confirmed",
    "done.sub.requested":
      "The {venue} team will confirm shortly. We'll email you all the details.",
    "done.sub.held": "Your deposit is held. We're saving your table at {venue}.",
    "done.sub.failed": "The deposit payment didn't go through. You can retry or contact the venue.",
    "done.code": "Code",
    "done.when": "Date & time",
    "done.party": "Guests",
    "done.deposit": "Deposit",
    "done.depositHeld": "held",
    "done.depositFailed": "failed",
    "done.newBooking": "New booking",
  },
} satisfies Record<Locale, Record<string, string>>;

export type Dict = (typeof dictionaries)["it"];

export function isLocale(s: string | undefined | null): s is Locale {
  return !!s && (SUPPORTED_LOCALES as readonly string[]).includes(s);
}

export function pickLocale(input?: string | null): Locale {
  if (isLocale(input)) return input;
  return DEFAULT_LOCALE;
}

export function t(locale: Locale, key: keyof Dict, vars?: Record<string, string | number>) {
  const raw = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? String(key);
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function dict(locale: Locale): Dict {
  return dictionaries[locale];
}
