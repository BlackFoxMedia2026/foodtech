/* eslint-disable no-console */
import { PrismaClient, BookingStatus, BookingSource, Occasion, LoyaltyTier, TableShape } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const FIRST = ["Lorenzo", "Giulia", "Matteo", "Sofia", "Andrea", "Camilla", "Tommaso", "Chiara", "Federico", "Alessia", "Marco", "Beatrice", "Riccardo", "Elena", "Davide", "Martina"];
const LAST = ["Ferri", "Conti", "Greco", "Russo", "Marini", "Bianchi", "De Luca", "Romano", "Esposito", "Ricci", "Galli", "Moretti", "Costa", "Vitale"];
const NOTES = [
  "Prefer table near the window",
  "Allergico ai crostacei",
  "Compleanno della moglie",
  "Cliente abituale dello chef",
  "Richiede menu vegano",
  null,
  null,
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function setTime(date: Date, h: number, m = 0) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function formatISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  const existingOrg = await db.organization.findUnique({
    where: { slug: "casa-aurora" },
    include: { venues: true },
  });
  if (existingOrg) {
    console.log("→ Org demo già presente, completo dati per i nuovi moduli…");
    for (const venue of existingOrg.venues) {
      await ensureDemoExtras(venue);
    }
    console.log("✓ Seed extras completato.");
    return;
  }

  console.log("→ Creazione organizzazione demo…");
  const passwordHash = await bcrypt.hash("tavolo2026", 10);

  const owner = await db.user.upsert({
    where: { email: "owner@tavolo.demo" },
    update: { passwordHash },
    create: {
      email: "owner@tavolo.demo",
      name: "Anna Conti",
      passwordHash,
    },
  });

  const org = await db.organization.create({
    data: {
      name: "Casa Aurora Hospitality",
      slug: "casa-aurora",
      plan: "GROWTH",
      members: { create: { userId: owner.id, role: "OWNER" } },
      venues: {
        create: [
          {
            name: "Aurora Bistrot",
            slug: "aurora-bistrot",
            kind: "RESTAURANT",
            city: "Milano",
            country: "IT",
            address: "Via dei Fiori 12",
            phone: "+39 02 555 0101",
            email: "ciao@auroramilano.it",
          },
          {
            name: "Riva Beach Club",
            slug: "riva-beach",
            kind: "BEACH_CLUB",
            city: "Forte dei Marmi",
            country: "IT",
            address: "Lungomare 88",
            phone: "+39 0584 555 220",
          },
        ],
      },
    },
    include: { venues: true },
  });

  for (const venue of org.venues) {
    await db.venueMembership.create({ data: { userId: owner.id, venueId: venue.id, role: "MANAGER" } });

    console.log(`→ Setup ${venue.name}`);

    // Sale + tavoli
    const room = await db.room.create({
      data: { venueId: venue.id, name: venue.kind === "BEACH_CLUB" ? "Spiaggia" : "Sala principale", width: 1200, height: 760 },
    });

    const tableDefs = venue.kind === "BEACH_CLUB"
      ? Array.from({ length: 18 }).map((_, i) => ({
          label: `Beach ${i + 1}`,
          seats: 4,
          shape: "LOUNGE" as const,
          posX: 80 + (i % 6) * 170,
          posY: 100 + Math.floor(i / 6) * 200,
        }))
      : [
          ...Array.from({ length: 8 }).map((_, i) => ({
            label: `T${i + 1}`,
            seats: 2,
            shape: TableShape.ROUND,
            posX: 80 + i * 130,
            posY: 120,
          })),
          ...Array.from({ length: 6 }).map((_, i) => ({
            label: `T${i + 9}`,
            seats: 4,
            shape: TableShape.SQUARE,
            posX: 100 + i * 170,
            posY: 320,
          })),
          ...Array.from({ length: 3 }).map((_, i) => ({
            label: `B${i + 1}`,
            seats: 6,
            shape: TableShape.BOOTH,
            posX: 140 + i * 290,
            posY: 540,
          })),
        ];

    await db.table.createMany({
      data: tableDefs.map((t) => ({ ...t, venueId: venue.id, roomId: room.id })),
    });

    // Turni
    for (let weekday = 0; weekday < 7; weekday++) {
      await db.shift.createMany({
        data: [
          { venueId: venue.id, name: "Pranzo", weekday, startMinute: 12 * 60, endMinute: 15 * 60, capacity: 60 },
          { venueId: venue.id, name: "Cena", weekday, startMinute: 19 * 60, endMinute: 23 * 60, capacity: 90 },
        ],
      });
    }

    // Guests
    const guests = await Promise.all(
      Array.from({ length: 60 }).map((_, i) => {
        const first = pick(FIRST);
        const last = pick(LAST);
        const visits = Math.floor(Math.random() * 14);
        const tier: LoyaltyTier =
          visits > 10 ? "AMBASSADOR" : visits > 6 ? "VIP" : visits > 2 ? "REGULAR" : "NEW";
        return db.guest.create({
          data: {
            venueId: venue.id,
            firstName: first,
            lastName: last,
            email: `${first.toLowerCase()}.${last.toLowerCase().replace(/\s/g, "")}${i}@example.com`,
            phone: `+39 3${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 9000000 + 1000000)}`,
            loyaltyTier: tier,
            totalVisits: visits,
            totalSpend: visits * (Math.floor(Math.random() * 60) + 35),
            tags: visits > 6 ? ["fedele"] : [],
            marketingOptIn: Math.random() > 0.3,
            preferences: Math.random() > 0.7 ? { table: "vista mare" } : undefined,
            allergies: Math.random() > 0.85 ? "Glutine" : null,
          },
        });
      }),
    );

    const tables = await db.table.findMany({ where: { venueId: venue.id } });

    // Bookings: ultimi 30 giorni + prossimi 14
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dayOffset = -30; dayOffset <= 14; dayOffset++) {
      const day = new Date(today);
      day.setDate(today.getDate() + dayOffset);

      const bookingsToday = 6 + Math.floor(Math.random() * 14);
      for (let i = 0; i < bookingsToday; i++) {
        const isLunch = Math.random() > 0.55;
        const baseHour = isLunch ? 12 + Math.floor(Math.random() * 3) : 19 + Math.floor(Math.random() * 4);
        const baseMin = pick([0, 15, 30, 45]);
        const startsAt = setTime(day, baseHour, baseMin);
        const partySize = 2 + Math.floor(Math.random() * 6);
        const guest = pick(guests);
        const table = pick(tables.filter((t) => t.seats >= partySize - 1)) ?? pick(tables);

        let status: BookingStatus = "CONFIRMED";
        if (dayOffset < 0) {
          const r = Math.random();
          if (r < 0.78) status = "COMPLETED";
          else if (r < 0.88) status = "NO_SHOW";
          else status = "CANCELLED";
        }

        await db.booking.create({
          data: {
            venueId: venue.id,
            guestId: guest.id,
            tableId: table.id,
            partySize,
            startsAt,
            durationMin: isLunch ? 90 : 120,
            status,
            source: pick<BookingSource>(["WIDGET", "PHONE", "WALK_IN", "GOOGLE", "SOCIAL", "CONCIERGE"]),
            occasion: Math.random() > 0.85 ? pick<Occasion>(["BIRTHDAY", "ANNIVERSARY", "BUSINESS", "DATE"]) : null,
            notes: pick(NOTES),
            depositCents: Math.random() > 0.7 ? 2000 * partySize : 0,
            depositStatus: Math.random() > 0.7 ? "HELD" : "NONE",
          },
        });
      }
    }

    // Esperienze
    if (venue.kind === "RESTAURANT") {
      await db.experience.create({
        data: {
          venueId: venue.id,
          title: "Cena degustazione tartufo bianco",
          slug: "degustazione-tartufo",
          description: "Sette portate dello chef in abbinamento a vini selezionati.",
          startsAt: setTime(new Date(today.getTime() + 7 * 86400000), 20, 0),
          endsAt: setTime(new Date(today.getTime() + 7 * 86400000), 23, 30),
          capacity: 24,
          priceCents: 12500,
          published: true,
        },
      });
    } else {
      await db.experience.create({
        data: {
          venueId: venue.id,
          title: "Sunset DJ Set & Cocktail",
          slug: "sunset-dj",
          description: "Live set in spiaggia con cocktail signature.",
          startsAt: setTime(new Date(today.getTime() + 4 * 86400000), 18, 30),
          endsAt: setTime(new Date(today.getTime() + 4 * 86400000), 22, 0),
          capacity: 120,
          priceCents: 3500,
          published: true,
        },
      });
    }

    // Campagna esempio
    await db.campaign.create({
      data: {
        venueId: venue.id,
        name: "Recupero clienti dormienti",
        channel: "EMAIL",
        subject: "Ti aspettiamo per una serata dedicata",
        body: "Sono passati 90 giorni dalla tua ultima visita…",
        status: "SENT",
        sentCount: 142,
        openedCount: 81,
        bookedCount: 19,
      },
    });

    await ensureDemoExtras(venue);
  }

  console.log("\n✓ Seed completato.");
  console.log("  Login demo:  owner@tavolo.demo  /  tavolo2026");
}

async function ensureDemoExtras(venue: { id: string; name: string; kind: string }) {
  // Templates: skip if already populated
  const tplCount = await db.messageTemplate.count({ where: { venueId: venue.id } });
  if (tplCount === 0) {
    await db.messageTemplate.createMany({
      data: [
        {
          venueId: venue.id,
          name: "Benvenuto nuovo ospite",
          channel: "EMAIL",
          category: "WELCOME",
          subject: "Benvenuto in {{firstName}}",
          body: "Ciao {{firstName}},\n\ngrazie di aver scelto " + venue.name + ".\n\nA presto!",
        },
        {
          venueId: venue.id,
          name: "Recupero clienti inattivi",
          channel: "EMAIL",
          category: "WIN_BACK",
          subject: "Ci manchi, {{firstName}}",
          body: "Ciao {{firstName}},\n\nè un po' che non ci vediamo. Abbiamo qualcosa di speciale per te.",
        },
        {
          venueId: venue.id,
          name: "Auguri compleanno",
          channel: "EMAIL",
          category: "BIRTHDAY",
          subject: "Buon compleanno {{firstName}}!",
          body: "Tantissimi auguri, {{firstName}}! Ti aspettiamo per festeggiare con un brindisi offerto dalla casa.",
        },
        {
          venueId: venue.id,
          name: "SMS tavolo pronto",
          channel: "SMS",
          category: "REMINDER",
          subject: null,
          body: "Ciao {{firstName}}, il tuo tavolo presso " + venue.name + " è pronto. Ti aspettiamo all'ingresso!",
        },
      ],
    });
  }

  // Menu: skip if already populated
  const menuCount = await db.menuCategory.count({ where: { venueId: venue.id } });
  if (menuCount === 0) {
    const menuKey = venue.kind === "BEACH_CLUB" ? "drinks" : "main";
    if (venue.kind === "BEACH_CLUB") {
      const cocktails = await db.menuCategory.create({
        data: { venueId: venue.id, name: "Signature Cocktail", menuKey, ordering: 0 },
      });
      const small = await db.menuCategory.create({
        data: { venueId: venue.id, name: "Small Plates", menuKey, ordering: 1 },
      });
      await db.menuItem.createMany({
        data: [
          {
            venueId: venue.id,
            categoryId: cocktails.id,
            name: "Riva Spritz",
            description: "Aperol, prosecco di Valdobbiadene, soda, scorza d'arancia.",
            priceCents: 1200,
            allergens: ["SULPHITES"],
            dietary: ["VEGAN", "GLUTEN_FREE"],
            ordering: 0,
          },
          {
            venueId: venue.id,
            categoryId: cocktails.id,
            name: "Negroni del Promontorio",
            description: "Gin botanico ligure, Campari, vermut alla camomilla.",
            priceCents: 1400,
            allergens: ["SULPHITES"],
            dietary: ["VEGAN"],
            ordering: 1,
          },
          {
            venueId: venue.id,
            categoryId: small.id,
            name: "Tartare di tonno e mango",
            description: "Cubetti di tonno rosso, mango, lime, sesamo nero.",
            priceCents: 1600,
            allergens: ["FISH", "SESAME"],
            dietary: ["GLUTEN_FREE"],
            ordering: 0,
          },
          {
            venueId: venue.id,
            categoryId: small.id,
            name: "Hummus della casa",
            description: "Ceci, tahina, paprika affumicata, focaccia croccante.",
            priceCents: 900,
            allergens: ["GLUTEN", "SESAME"],
            dietary: ["VEGAN"],
            ordering: 1,
          },
        ],
      });
    } else {
      const antipasti = await db.menuCategory.create({
        data: { venueId: venue.id, name: "Antipasti", menuKey, ordering: 0 },
      });
      const primi = await db.menuCategory.create({
        data: { venueId: venue.id, name: "Primi piatti", menuKey, ordering: 1 },
      });
      const secondi = await db.menuCategory.create({
        data: { venueId: venue.id, name: "Secondi", menuKey, ordering: 2 },
      });
      const dolci = await db.menuCategory.create({
        data: { venueId: venue.id, name: "Dolci", menuKey, ordering: 3 },
      });
      await db.menuItem.createMany({
        data: [
          {
            venueId: venue.id,
            categoryId: antipasti.id,
            name: "Burrata di Andria con pomodorino confit",
            description: "Burrata fresca, pomodorino confit, basilico, olio EVO.",
            priceCents: 1400,
            allergens: ["DAIRY"],
            dietary: ["VEGETARIAN", "GLUTEN_FREE"],
            ordering: 0,
          },
          {
            venueId: venue.id,
            categoryId: antipasti.id,
            name: "Vitello tonnato",
            description: "Sottile fesa di vitello, salsa tonnata, capperi di Pantelleria.",
            priceCents: 1600,
            allergens: ["FISH", "EGGS", "MUSTARD"],
            ordering: 1,
          },
          {
            venueId: venue.id,
            categoryId: primi.id,
            name: "Tagliolini al tartufo nero",
            description: "Tagliolini freschi all'uovo, fonduta di parmigiano, tartufo nero.",
            priceCents: 2200,
            allergens: ["GLUTEN", "EGGS", "DAIRY"],
            ordering: 0,
          },
          {
            venueId: venue.id,
            categoryId: primi.id,
            name: "Risotto agli scampi e zafferano",
            description: "Carnaroli mantecato, scampi marinati, polvere di lime.",
            priceCents: 2400,
            allergens: ["SHELLFISH", "DAIRY"],
            dietary: ["GLUTEN_FREE"],
            ordering: 1,
          },
          {
            venueId: venue.id,
            categoryId: secondi.id,
            name: "Costata di fassona dry aged",
            description: "Costata di fassona piemontese 30gg, sale Maldon, patate al rosmarino.",
            priceCents: 3800,
            dietary: ["GLUTEN_FREE"],
            ordering: 0,
          },
          {
            venueId: venue.id,
            categoryId: secondi.id,
            name: "Branzino in crosta di sale",
            description: "Branzino dell'Adriatico, finocchi al limone, salsa al prezzemolo.",
            priceCents: 3200,
            allergens: ["FISH"],
            dietary: ["GLUTEN_FREE"],
            ordering: 1,
          },
          {
            venueId: venue.id,
            categoryId: dolci.id,
            name: "Tiramisù della tradizione",
            description: "Mascarpone, savoiardi imbevuti di caffè espresso, cacao amaro.",
            priceCents: 900,
            allergens: ["GLUTEN", "EGGS", "DAIRY"],
            dietary: ["VEGETARIAN"],
            ordering: 0,
          },
          {
            venueId: venue.id,
            categoryId: dolci.id,
            name: "Sorbetto al limone della costa",
            description: "Sorbetto artigianale al limone di Sorrento, scorza candita.",
            priceCents: 700,
            dietary: ["VEGAN", "GLUTEN_FREE", "LACTOSE_FREE"],
            ordering: 1,
          },
        ],
      });
    }

  }

  // Waitlist: only seed if empty
  const wlCount = await db.waitlistEntry.count({
    where: { venueId: venue.id, status: { in: ["WAITING", "NOTIFIED"] } },
  });
  if (wlCount === 0) {
    await db.waitlistEntry.createMany({
      data: [
        {
          venueId: venue.id,
          guestName: "Famiglia Greco",
          partySize: 4,
          phone: "+39 333 12 34 567",
          expectedWaitMin: 15,
          status: "WAITING",
          notes: "Preferiscono tavolo all'aperto se libero",
        },
        {
          venueId: venue.id,
          guestName: "Coppia Rossi",
          partySize: 2,
          phone: "+39 333 76 54 321",
          email: "rossi@example.com",
          expectedWaitMin: 25,
          status: "WAITING",
        },
      ],
    });
  }

  // Coupon demo (idempotente per code unique)
  const couponSamples: Array<{
    code: string;
    name: string;
    kind: "PERCENT" | "FIXED" | "FREE_ITEM";
    value: number;
    category: "BIRTHDAY" | "WINBACK" | "WIFI" | "NEW_CUSTOMER";
    description?: string;
    freeItem?: string;
  }> = [
    {
      code: `WELCOME-${venue.id.slice(-4).toUpperCase()}`,
      name: "Benvenuto: 10% sulla prima cena",
      kind: "PERCENT",
      value: 10,
      category: "NEW_CUSTOMER",
      description: "Sconto del 10% riservato ai nuovi ospiti dopo la prima visita.",
    },
    {
      code: `BDAY-${venue.id.slice(-4).toUpperCase()}`,
      name: "Compleanno: calice in omaggio",
      kind: "FREE_ITEM",
      value: 0,
      freeItem: "Calice di Franciacorta",
      category: "BIRTHDAY",
      description: "Auguri! Brindisi della casa per festeggiare.",
    },
    {
      code: `BACK-${venue.id.slice(-4).toUpperCase()}`,
      name: "Ti rivogliamo qui: 15€ di sconto",
      kind: "FIXED",
      value: 1500,
      category: "WINBACK",
      description: "Per chi non ci visita da più di 90 giorni.",
    },
    {
      code: `WIFI-${venue.id.slice(-4).toUpperCase()}`,
      name: "Wi-Fi reward: dolce in omaggio",
      kind: "FREE_ITEM",
      value: 0,
      freeItem: "Dolce della casa",
      category: "WIFI",
      description: "Per chi si è connesso al Wi-Fi del locale e ha lasciato i contatti.",
    },
  ];
  for (const c of couponSamples) {
    await db.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        venueId: venue.id,
        code: c.code,
        name: c.name,
        description: c.description ?? null,
        kind: c.kind,
        value: c.value,
        freeItem: c.freeItem ?? null,
        category: c.category,
        status: "ACTIVE",
        maxPerGuest: 1,
      },
    });
  }

  // Wi-Fi demo lead (only if empty)
  const wfCount = await db.wifiLead.count({ where: { venueId: venue.id } });
  if (wfCount === 0) {
    const guest = await db.guest.findFirst({ where: { venueId: venue.id } });
    if (guest) {
      const lead = await db.wifiLead.create({
        data: {
          venueId: venue.id,
          guestId: guest.id,
          name: `${guest.firstName} ${guest.lastName ?? ""}`.trim(),
          email: guest.email,
          phone: guest.phone,
          source: "ssid:tavolo-guest",
          consentMarketing: true,
          consentPrivacy: true,
        },
      });
      await db.wifiSession.create({
        data: {
          leadId: lead.id,
          venueId: venue.id,
          deviceType: "mobile",
          startedAt: new Date(Date.now() - 2 * 86400_000),
          endedAt: new Date(Date.now() - 2 * 86400_000 + 90 * 60 * 1000),
          durationSec: 90 * 60,
        },
      });
      await db.consentLog.createMany({
        data: [
          {
            venueId: venue.id,
            guestId: guest.id,
            leadId: lead.id,
            channel: "PRIVACY",
            granted: true,
            source: "wifi",
          },
          {
            venueId: venue.id,
            guestId: guest.id,
            leadId: lead.id,
            channel: "MARKETING_GENERAL",
            granted: true,
            source: "wifi",
          },
        ],
      });
    }
  }

  // Review links demo (idempotent: skip if any present)
  const rlCount = await db.reviewLink.count({ where: { venueId: venue.id } });
  if (rlCount === 0) {
    await db.reviewLink.createMany({
      data: [
        {
          venueId: venue.id,
          platform: "GOOGLE",
          url: `https://search.google.com/local/writereview?placeid=demo-${venue.id.slice(-6)}`,
          ordering: 0,
        },
        {
          venueId: venue.id,
          platform: "TRIPADVISOR",
          url: `https://www.tripadvisor.it/Restaurant_Review-${venue.id.slice(-6)}`,
          ordering: 1,
        },
      ],
    });
  }

  // Marketing automation demo workflows (idempotent: skip if any present)
  const wfPresent = await db.automationWorkflow.count({ where: { venueId: venue.id } });
  if (wfPresent === 0) {
    await db.automationWorkflow.createMany({
      data: [
        {
          venueId: venue.id,
          name: "Grazie post-visita su WhatsApp",
          description: "Saluto al cliente subito dopo la chiusura del tavolo.",
          trigger: "BOOKING_COMPLETED",
          active: true,
          conditions: { requireConsent: true },
          actions: [
            {
              kind: "SEND_WHATSAPP",
              params: {
                body:
                  "Grazie {{firstName}}! Ci ha fatto piacere ospitarti da " +
                  venue.name +
                  ". Se ti va, lasciaci un feedback.",
              },
            },
          ],
        },
        {
          venueId: venue.id,
          name: "Recupero NPS detrattore",
          description:
            "Avvisa lo staff e tagga il guest quando arriva un punteggio basso, così il manager può chiamare.",
          trigger: "NPS_DETRACTOR",
          active: true,
          conditions: { requireConsent: false },
          actions: [
            { kind: "ADD_GUEST_TAG", params: { tag: "nps-detractor" } },
            {
              kind: "CREATE_STAFF_TASK",
              params: {
                title: "Richiamare ospite",
                details: "Feedback negativo: contattare entro 24h per recuperare la relazione.",
              },
            },
          ],
        },
        {
          venueId: venue.id,
          name: "Win-back inattivi 90 giorni",
          description: "Coupon e messaggio agli ospiti che non tornano da 3 mesi.",
          trigger: "GUEST_INACTIVE",
          active: false,
          conditions: { inactiveDays: 90, minVisits: 1, requireConsent: true },
          actions: [
            {
              kind: "CREATE_COUPON",
              params: {
                couponName: "Ti rivogliamo",
                couponKind: "PERCENT",
                couponValue: 15,
                couponDays: 45,
                couponCategory: "WINBACK",
              },
            },
            {
              kind: "SEND_EMAIL",
              params: {
                subject: "Ci manchi, {{firstName}}",
                body:
                  "Ciao {{firstName}}, è da un po' che non ti vediamo. " +
                  "Abbiamo creato un coupon dedicato per te: ti aspettiamo da " +
                  venue.name +
                  ".",
              },
            },
          ],
        },
        {
          venueId: venue.id,
          name: "Benvenuto Wi-Fi",
          description:
            "Email di ringraziamento + tag per chi si registra al captive portal.",
          trigger: "WIFI_LEAD_CREATED",
          active: false,
          conditions: { requireConsent: true },
          actions: [
            { kind: "ADD_GUEST_TAG", params: { tag: "wifi-onboarded" } },
            {
              kind: "SEND_EMAIL",
              params: {
                subject: "Benvenuto da " + venue.name,
                body:
                  "Grazie per esserti collegato {{firstName}}. " +
                  "La prossima volta passa a salutarci, ti aspettiamo!",
              },
            },
          ],
        },
      ],
    });
  }

  // Demo conversational booking session
  const csCount = await db.chatSession.count({ where: { venueId: venue.id } });
  if (csCount === 0) {
    const session = await db.chatSession.create({
      data: {
        venueId: venue.id,
        source: "WEB",
        status: "CONVERTED",
        draftPartySize: 4,
        draftDate: formatISO(new Date()),
        draftTime: "20:30",
        draftFirstName: "Giulia",
        draftLastName: "Bianchi",
        draftEmail: "giulia@example.com",
      },
    });
    await db.chatMessage.createMany({
      data: [
        { sessionId: session.id, role: "BOT", text: `Ciao! Sono l'assistente di ${venue.name}.`, intent: "GREETING" },
        { sessionId: session.id, role: "USER", text: "Vorrei prenotare per 4 stasera alle 20:30" },
        { sessionId: session.id, role: "BOT", text: "Perfetto, a che nome?", intent: "ASK_NAME" },
        { sessionId: session.id, role: "USER", text: "Giulia Bianchi, giulia@example.com" },
        { sessionId: session.id, role: "BOT", text: "Confermato! A presto.", intent: "BOOKED" },
      ],
    });
  }

  // Demo voice draft + missed call
  const callCount = await db.callLog.count({ where: { venueId: venue.id } });
  if (callCount === 0) {
    const draft = await db.voiceBookingDraft.create({
      data: {
        venueId: venue.id,
        callerName: "Marco Rossi",
        phone: "+390000000001",
        partySize: 2,
        preferredDate: formatISO(new Date(Date.now() + 86400_000)),
        preferredTime: "21:00",
        notes: "Trascrizione: vorrei prenotare per due persone domani sera alle nove.",
      },
    });
    await db.callLog.create({
      data: {
        venueId: venue.id,
        fromNumber: "+390000000001",
        toNumber: venue.kind === "BEACH_CLUB" ? "+390000000099" : null,
        status: "COMPLETED",
        durationSec: 47,
        intent: "BOOKING",
        transcript:
          "Buongiorno, sono Marco Rossi e vorrei prenotare per due persone domani sera alle ventuno.",
        draftId: draft.id,
        startedAt: new Date(Date.now() - 3600_000),
        endedAt: new Date(Date.now() - 3550_000),
      },
    });
    await db.missedCall.create({
      data: { venueId: venue.id, fromNumber: "+390000000002" },
    });
  }

  // Demo finance entries (food cost, staff shifts, dish food costs)
  const ceCount = await db.costEntry.count({ where: { venueId: venue.id } });
  if (ceCount === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayBefore = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d;
    };
    await db.costEntry.createMany({
      data: [
        {
          venueId: venue.id,
          category: "FOOD",
          label: "Fornitura pesce",
          amountCents: 84_000,
          occurredOn: dayBefore(2),
        },
        {
          venueId: venue.id,
          category: "BEVERAGE",
          label: "Cantina vini",
          amountCents: 132_000,
          occurredOn: dayBefore(7),
        },
        {
          venueId: venue.id,
          category: "RENT",
          label: "Affitto mensile",
          amountCents: 280_000,
          recurring: true,
          occurredOn: dayBefore(14),
        },
        {
          venueId: venue.id,
          category: "MARKETING",
          label: "Campagna social locale",
          amountCents: 18_000,
          occurredOn: dayBefore(5),
        },
      ],
    });
  }
  const sshiftCount = await db.staffShift.count({ where: { venueId: venue.id } });
  if (sshiftCount === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayBefore = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d;
    };
    await db.staffShift.createMany({
      data: [
        {
          venueId: venue.id,
          staffName: "Lucia",
          role: "Sala",
          date: dayBefore(1),
          hours: 7,
          hourlyCents: 1300,
        },
        {
          venueId: venue.id,
          staffName: "Davide",
          role: "Cucina",
          date: dayBefore(1),
          hours: 8,
          hourlyCents: 1500,
        },
        {
          venueId: venue.id,
          staffName: "Marta",
          role: "Bar",
          date: dayBefore(2),
          hours: 6,
          hourlyCents: 1200,
        },
      ],
    });
  }
  const sampleItems = await db.menuItem.findMany({
    where: { venueId: venue.id },
    select: { id: true, priceCents: true },
    take: 6,
  });
  for (const it of sampleItems) {
    await db.menuItemCost
      .upsert({
        where: { menuItemId: it.id },
        update: {},
        create: {
          venueId: venue.id,
          menuItemId: it.id,
          costCents: Math.max(0, Math.round(it.priceCents * 0.32)),
        },
      })
      .catch(() => undefined);
  }

  // Demo channel-manager connectors
  const connectorCount = await db.connector.count({ where: { venueId: venue.id } });
  if (connectorCount === 0) {
    await db.connector.createMany({
      data: [
        {
          venueId: venue.id,
          kind: "THEFORK",
          label: "TheFork (demo)",
          status: "DRAFT",
          externalRef: `fork-${venue.id.slice(-6)}`,
        },
        {
          venueId: venue.id,
          kind: "GOOGLE_RESERVE",
          label: "Google Reserve (demo)",
          status: "DRAFT",
        },
      ],
    });
  }

  // Demo menu scans
  const msCount = await db.menuScan.count({ where: { venueId: venue.id } });
  if (msCount === 0) {
    await db.menuScan.createMany({
      data: [
        { venueId: venue.id, menuKey: "main", source: "QR" },
        { venueId: venue.id, menuKey: "main", source: "QR", email: "ospite-curioso@example.com", consentMarketing: true },
        { venueId: venue.id, menuKey: "main", source: "TABLE" },
      ],
    });
  }

  // Demo MessageLog rows (so the operator sees a populated dispatch log).
  const mlCount = await db.messageLog.count({ where: { venueId: venue.id } });
  if (mlCount === 0) {
    const sampleGuest = await db.guest.findFirst({
      where: { venueId: venue.id, email: { not: null } },
      select: { id: true, email: true, phone: true, firstName: true },
    });
    if (sampleGuest) {
      const now = Date.now();
      await db.messageLog.createMany({
        data: [
          {
            venueId: venue.id,
            guestId: sampleGuest.id,
            channel: "EMAIL",
            toAddress: sampleGuest.email!,
            subject: "Promemoria H-24",
            bodyPreview: `Ciao ${sampleGuest.firstName}, ti aspettiamo domani.`,
            status: "SENT",
            sentAt: new Date(now - 6 * 3600_000),
          },
          {
            venueId: venue.id,
            guestId: sampleGuest.id,
            channel: "WHATSAPP",
            toAddress: sampleGuest.phone ?? "+39000000000",
            bodyPreview: "Grazie per la visita di ieri 🌿",
            status: sampleGuest.phone ? "SENT" : "SKIPPED",
            error: sampleGuest.phone ? null : "no_provider",
            sentAt: sampleGuest.phone ? new Date(now - 2 * 3600_000) : null,
            failedAt: sampleGuest.phone ? null : new Date(now - 2 * 3600_000),
          },
        ],
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
