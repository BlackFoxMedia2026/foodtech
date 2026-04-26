# Tavolo — gestionale ospitalità

Multi-tenant SaaS per ristoranti e beach club: prenotazioni, sala, CRM, marketing,
chatbot, voice assistant, food cost. Stack: Next.js 14 App Router · TypeScript ·
Prisma + PostgreSQL · Tailwind + shadcn-style UI · NextAuth Credentials.

## Multi-tenancy

`Organization → Venue → resources`. Ogni query passa per `getActiveVenue()`
(`src/lib/tenant.ts`) che risolve `venueId` + `role` dal cookie attivo. RBAC in
`can(role, ability)`:

| Role        | Abilities                                                                 |
| ----------- | ------------------------------------------------------------------------- |
| MANAGER     | manage_venue · manage_bookings · view_revenue · edit_marketing · view_private |
| RECEPTION   | manage_bookings                                                           |
| WAITER      | manage_bookings                                                           |
| MARKETING   | edit_marketing · view_revenue                                             |
| READ_ONLY   | (nessuna)                                                                 |

## Provider adapter pattern

Ogni integrazione esterna è dietro un'interfaccia con fallback no-op, così il
build non rompe se le env mancano:

| File                         | Provider                                | Env per attivare                              |
| ---------------------------- | --------------------------------------- | --------------------------------------------- |
| `src/lib/email.ts`           | Resend                                  | `RESEND_API_KEY` (+ `RESEND_FROM`)            |
| `src/lib/messaging.ts`       | Twilio SMS / WhatsApp                   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_SMS`/`TWILIO_FROM_WHATSAPP` |
| `src/lib/voice-provider.ts`  | Twilio Voice (Studio/Vapi/Retell stub)  | `TWILIO_FROM_VOICE` + Twilio creds            |
| `src/lib/wifi-provider.ts`   | HTTP hook captive portal                | `WIFI_HOOK_URL`                               |
| `src/lib/stripe.ts`          | Stripe deposits                         | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`  |
| `src/lib/ai.ts`              | Anthropic                               | `ANTHROPIC_API_KEY`                           |

## Roadmap moduli (4 step)

### Step 1 — Wi-Fi marketing + Coupon + Review funnel

- Schema: `WifiLead`, `WifiSession`, `Coupon`, `CouponRedemption`, `ReviewLink`,
  `ReviewLinkClick`, `ConsentLog` (+ enums `CouponKind/Status/Category`,
  `ReviewPlatform`, `ConsentChannel`).
- Server: `src/server/wifi.ts`, `src/server/coupons.ts`, `src/server/review-links.ts`.
- API: `/api/wifi/[slug]`, `/api/coupons/*`, `/api/review-links/*`, `/api/r/[id]`.
- Pagine: `/(public)/wifi/[slug]`, `/(public)/coupon/[code]`, `/(app)/wifi`, `/(app)/coupons`.
- Survey post-visita rifatto con branching PROMOTER/DETRACTOR.

### Step 2 — WhatsApp/SMS reali-ready + Marketing Automation builder

- Schema: `MessageLog`, `AutomationWorkflow`, `AutomationRun` (+ enums per channel,
  status, trigger, run status).
- `src/server/messages.ts`: `dispatchMessage()` unifica email/SMS/WhatsApp e
  scrive `MessageLog`; `hasConsent()` controlla l'ultimo `ConsentLog` per canale
  con fallback su `Guest.marketingOptIn`.
- `src/server/automations.ts`: builder con 9 trigger
  (`BOOKING_CREATED/COMPLETED`, `GUEST_BIRTHDAY/INACTIVE`, `COUPON_NOT_USED`,
  `NPS_DETRACTOR`, `WIFI_LEAD_CREATED`, `ORDER_COMPLETED`, `CUSTOM`) e 6 azioni
  (`SEND_EMAIL/SMS/WHATSAPP`, `CREATE_COUPON`, `ADD_GUEST_TAG`, `CREATE_STAFF_TASK`).
  - `fireTrigger()` agganciato in `bookings.ts`, `widget.ts`, `surveys.ts`,
    `wifi.ts`, `orders.ts`, `menu-leadmagnet.ts`.
  - `scanScheduledTriggers()` chiamato dal cron giornaliero
    `/api/cron/reminders` (Hobby plan: un solo cron al giorno).
- API: `/api/automations`, `/api/automations/[id]`.
- Pagina admin: `/(app)/automations` con list + builder dialog.
- Campagne ora multi-channel: `sendCampaign` filtra `email` vs `phone` in base
  al canale, send route accetta SMS/WhatsApp, `/(app)/campaigns` mostra il
  registro `MessageLog` con totali 30gg per channel/status.

### Step 3 — Chatbot prenotazioni embeddable + Voice scaffold

- Schema: `ChatSession`, `ChatMessage`, `CallLog`, `VoiceBookingDraft`,
  `MissedCall`.
- `src/server/chat.ts`: state machine deterministico (party size → date →
  time → name → contact → confirm), `parseDate()` capisce "stasera/domani/
  venerdì"/`dd-mm-yyyy`, `parseTime()` `HH:MM`/`H.MM`/`20`, fallback handoff
  se l'utente scrive "operatore"/"staff". Crea booking con
  `createPublicBooking()`.
- `src/server/voice.ts`: webhook trascrizione → `VoiceBookingDraft` (parser
  rule-based) → review manager. `approveVoiceDraft()` crea il booking,
  `scheduleMissedCallback()` chiama `voiceProvider.scheduleCallback()`.
- API: `POST /api/chat/[slug]` (start), `POST /api/chat/sessions/[id]` (turn),
  `POST /api/voice/[slug]` (webhook con `x-voice-secret`),
  `POST /api/voice/drafts/[id]?action=approve|reject`,
  `POST /api/voice/missed/[id]`.
- UI: `/(public)/chat/[slug]` + drop-in `<script src="/embed/chat.js"
  data-venue="…">`. Admin in `/(app)/chat` (snippet, sessioni, messaggi
  recenti) e `/(app)/voice` (webhook URL, bozze, chiamate perse, registro).

### Step 4 — Staff performance + Controllo economico + Menu lead magnet

- Schema: `CostEntry` (+ `CostCategory`), `StaffShift`, `MenuItemCost`,
  `MenuScan` (+ `MenuScanSource`).
- `src/server/staff-performance.ts`: aggrega `BookingEvent` per `actorId`
  → `bookingsCreated`, `statusUpdates`, `noShows`, `cancellations`.
- `src/server/finance.ts`: CRUD costi/turni + `setMenuItemCost()` upsert,
  `financeOverview()` calcola margine/food cost%/labor cost% su 30gg.
- `src/server/menu-leadmagnet.ts`: `recordMenuScan()` con dedup per
  email/phone, hash IP (`MENU_LEAD_HASH_SALT`), modalità scelte da
  `MENU_LEAD_MAGNET_MODE` (`PUBLIC` default, `CONTACT`, `OPT_IN`). Fa
  partire `WIFI_LEAD_CREATED` per riusare le automazioni esistenti.
- API: `/api/finance/costs[/id]`, `/api/finance/shifts[/id]`,
  `/api/finance/menu-costs`, `/api/menu-scan/[slug]`.
- Pagine: `/(app)/finance`, `/(app)/staff/performance`, `MenuUnlock` su
  `/(public)/m/[slug]`.

## Convenzioni

- **Idempotenza seed**: `prisma/seed.ts` riapplica solo se `count() === 0`. Per
  aggiungere demo data ai venue esistenti, estendere `ensureDemoExtras(venue)`.
- **Schema migrations**: in dev `npx prisma db push`. In Vercel build,
  `scripts/prepare-env.mjs` esegue `prisma db push` su `DATABASE_URL`/
  `DIRECT_URL` (Neon).
- **Sidebar**: aggiornare `src/components/shell/sidebar.tsx`.
- **Permessi nuove API**: usare `can(ctx.role, …)` con uno degli ability
  della matrice.

## Comandi

```bash
npm run dev          # Next.js dev server
npm run lint         # next lint
npm run build        # next build (esegue anche prisma generate)
npx tsc --noEmit     # typecheck puro
npx prisma db push   # sync schema su DB locale
npx tsx prisma/seed.ts  # seed/upgrade demo data
```

## Branch attivo

Tutto lo sviluppo recente è su `claude/hospitality-saas-platform-ZU4bJ`
(commit `500efba` → `77695e0`).
