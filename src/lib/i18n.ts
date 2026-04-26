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
    "chat.assistant": "Assistente prenotazioni",
    "chat.placeholder": "Scrivi un messaggio…",
    "chat.closed": "Conversazione chiusa",
    "chat.typing": "…sto scrivendo",
    "chat.error": "Mi spiace, c'è stato un errore. Vuoi riprovare?",
    "manage.kicker": "La tua prenotazione",
    "manage.code": "Codice",
    "manage.bookedAs": "A nome di {name}",
    "manage.party": "Persone",
    "manage.date": "Data",
    "manage.time": "Ora",
    "manage.notes": "Note per il locale",
    "manage.notesPlaceholder": "Allergie, occasione, posto preferito…",
    "manage.cancel": "Annulla prenotazione",
    "manage.save": "Salva modifiche",
    "manage.saving": "Salvataggio…",
    "manage.confirmCancel": "Confermi l'annullamento?",
    "manage.cancelled": "Prenotazione annullata. Riceverai una conferma via email.",
    "manage.updated": "Aggiornato. Lo staff riceve una notifica.",
    "manage.lockNote": "Le modifiche sono possibili fino a 2 ore prima dell'orario.",
    "manage.statusClosed":
      "Questa prenotazione è in stato {status}: non puoi più modificarla. Per assistenza contatta il locale.",
    "manage.error.not_found": "Prenotazione non trovata.",
    "manage.error.locked": "Questa prenotazione non è più modificabile.",
    "manage.error.already_closed": "La prenotazione è già stata chiusa.",
    "manage.error.too_late": "Mancano meno di 2 ore: contatta il locale per modifiche.",
    "manage.error.slot_unavailable": "Slot non disponibile, prova un altro orario.",
    "manage.error.invalid_datetime": "Data o ora non valida.",
    "manage.error.rate_limited": "Hai fatto troppe richieste, riprova tra poco.",
    "manage.error.invalid_input": "Controlla i campi.",
    "manage.error.update_failed": "Modifica non riuscita.",
    "manage.error.cancel_failed": "Annullamento non riuscito.",
    "menuUnlock.title": "Sblocca il menu di {venue}",
    "menuUnlock.copy.optIn":
      "Lascia il tuo contatto e riceverai una sorpresa: novità di stagione, eventi e un piccolo benvenuto al primo passaggio.",
    "menuUnlock.copy.contact":
      "Lascia un contatto: ti inviamo gli aggiornamenti del menu e nessuno spam.",
    "menuUnlock.email": "Email",
    "menuUnlock.phone": "Telefono (opzionale)",
    "menuUnlock.consent":
      "Acconsento a ricevere comunicazioni promozionali da {venue}. Posso annullare in qualsiasi momento.",
    "menuUnlock.errorContactRequired": "Inserisci email o telefono.",
    "menuUnlock.errorConsent": "Conferma il consenso per ricevere il menu.",
    "menuUnlock.errorGeneric": "Qualcosa è andato storto. Riprova.",
    "menuUnlock.cta": "Vedi il menu",
    "menuUnlock.busy": "Sto sbloccando…",
    "bot.greeting":
      "Ciao! Sono l'assistente prenotazioni di {venue}. Posso aiutarti a riservare un tavolo. Per quante persone?",
    "bot.qr.book": "Voglio prenotare",
    "bot.qr.hours": "Vorrei sapere gli orari",
    "bot.qr.staff": "Parlate con uno staff",
    "bot.handoff":
      "Va bene! Ho avvisato lo staff. Lasciami il tuo numero o l'email e ti ricontattano.",
    "bot.askParty": "Perfetto! Per quante persone vorresti prenotare?",
    "bot.askDate":
      "Per {party} persone — per quale giorno? (es. \"stasera\", \"domani\", \"venerdì\", o una data)",
    "bot.qr.tonight": "Stasera",
    "bot.qr.tomorrow": "Domani",
    "bot.qr.friday": "Venerdì",
    "bot.qr.saturday": "Sabato",
    "bot.noSlots":
      "Per il {date} per {party} non vedo disponibilità. Prova un altro giorno o scrivimi \"operatore\" per parlarne con lo staff.",
    "bot.askTime":
      "Per il {date} ho questi orari liberi: {slots}. A che ora preferisci?",
    "bot.slotTaken": "Quell'orario è già pieno. Disponibili: {slots}. Quale scegli?",
    "bot.dayFull": "Quel giorno è completo. Vuoi provare un'altra data?",
    "bot.askName": "Ottimo. A che nome posso prenotare? (nome e cognome)",
    "bot.askContact":
      "Perfetto {first}! Mi lasci un'email o un numero di telefono per la conferma?",
    "bot.confirm":
      "Confermo: {party} persone il {date} alle {time} a nome {name}. Procedo?",
    "bot.qr.confirm": "Sì, conferma",
    "bot.qr.cancel": "Annulla",
    "bot.booked":
      "Fatto! Prenotazione confermata, riferimento {reference}. A presto da {venue}!",
    "bot.error.slotJustTaken":
      "Mi spiace, l'orario si è appena occupato. Vuoi che ti proponga le alternative più vicine?",
    "bot.error.generic": "Qualcosa è andato storto: {code}. Vuoi che chiami lo staff?",
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
    "chat.assistant": "Booking assistant",
    "chat.placeholder": "Type a message…",
    "chat.closed": "Conversation closed",
    "chat.typing": "…thinking",
    "chat.error": "Something went wrong, want to try again?",
    "manage.kicker": "Your booking",
    "manage.code": "Code",
    "manage.bookedAs": "Booked as {name}",
    "manage.party": "Guests",
    "manage.date": "Date",
    "manage.time": "Time",
    "manage.notes": "Notes for the venue",
    "manage.notesPlaceholder": "Allergies, occasion, preferred seat…",
    "manage.cancel": "Cancel booking",
    "manage.save": "Save changes",
    "manage.saving": "Saving…",
    "manage.confirmCancel": "Confirm cancellation?",
    "manage.cancelled": "Booking cancelled. You'll receive a confirmation email.",
    "manage.updated": "Updated. The venue has been notified.",
    "manage.lockNote": "You can edit up until 2 hours before the booking.",
    "manage.statusClosed":
      "This booking is in {status} status: it can no longer be edited. Contact the venue for help.",
    "manage.error.not_found": "Booking not found.",
    "manage.error.locked": "This booking can no longer be modified.",
    "manage.error.already_closed": "The booking is already closed.",
    "manage.error.too_late": "Less than 2 hours to go: contact the venue for changes.",
    "manage.error.slot_unavailable": "Slot unavailable, try another time.",
    "manage.error.invalid_datetime": "Invalid date or time.",
    "manage.error.rate_limited": "Too many requests, retry shortly.",
    "manage.error.invalid_input": "Please check the form fields.",
    "manage.error.update_failed": "Could not save the change.",
    "manage.error.cancel_failed": "Cancellation failed.",
    "menuUnlock.title": "Unlock {venue}'s menu",
    "menuUnlock.copy.optIn":
      "Leave your contact and we'll send a little welcome: seasonal news, events and a small gift on your first visit.",
    "menuUnlock.copy.contact":
      "Drop a contact: we'll send menu updates, no spam.",
    "menuUnlock.email": "Email",
    "menuUnlock.phone": "Phone (optional)",
    "menuUnlock.consent":
      "I consent to receive promotional communications from {venue}. I can unsubscribe at any time.",
    "menuUnlock.errorContactRequired": "Please enter an email or phone number.",
    "menuUnlock.errorConsent": "Please confirm consent to receive the menu.",
    "menuUnlock.errorGeneric": "Something went wrong. Please retry.",
    "menuUnlock.cta": "View the menu",
    "menuUnlock.busy": "Unlocking…",
    "bot.greeting":
      "Hi! I'm {venue}'s booking assistant. Happy to help you reserve a table. How many guests?",
    "bot.qr.book": "I want to book",
    "bot.qr.hours": "I'd like to know your hours",
    "bot.qr.staff": "Talk to a staff member",
    "bot.handoff":
      "Sure! I've notified the team. Leave your number or email and they'll get back to you.",
    "bot.askParty": "Great! For how many guests?",
    "bot.askDate":
      "For {party} guests — which day? (e.g. \"tonight\", \"tomorrow\", \"Friday\", or a date)",
    "bot.qr.tonight": "Tonight",
    "bot.qr.tomorrow": "Tomorrow",
    "bot.qr.friday": "Friday",
    "bot.qr.saturday": "Saturday",
    "bot.noSlots":
      "I can't find availability for {date} with {party} guests. Try a different day or write \"staff\" to talk to a person.",
    "bot.askTime":
      "On {date} we have these times open: {slots}. Which works for you?",
    "bot.slotTaken": "That time just filled up. Open: {slots}. Which one shall we lock in?",
    "bot.dayFull": "That day is full. Want to try another date?",
    "bot.askName": "Lovely. Under what name should I book? (first and last)",
    "bot.askContact":
      "Perfect {first}! Could you leave an email or phone number for the confirmation?",
    "bot.confirm":
      "Just to confirm: {party} guests on {date} at {time} for {name}. Shall I proceed?",
    "bot.qr.confirm": "Yes, confirm",
    "bot.qr.cancel": "Cancel",
    "bot.booked":
      "Done! Booking confirmed, reference {reference}. See you at {venue}!",
    "bot.error.slotJustTaken":
      "I'm sorry, that time was just taken. Want me to suggest the closest alternatives?",
    "bot.error.generic": "Something went wrong: {code}. Want me to call the staff?",
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
