// Smart upsell suggestions for pre-order carts.
//
// Pure-heuristic recommendation engine (no LLM). Given the current cart,
// we look at the rest of the venue's active menu and propose 1-3 hints
// styled as a concierge-side gesture ("Would you like a red wine to
// accompany the pasta?"). Each hint comes with up to 3 concrete menu
// items so the UI can render add buttons.
//
// IMPORTANTI LIMITI:
// - Il prompt originale ipotizzava un campo `tags String[]` su MenuItem,
//   che in questo schema non esiste. Usiamo invece:
//     * `MenuCategory.name` (es. "Antipasti", "Pasta", "Vini Rossi") come
//       prima fonte di tag impliciti.
//     * `MenuItem.dietary` (es. ["VEGAN"]) per cross-suggestion dietetiche.
//     * fallback su `MenuItem.name`/`description` con pattern italiani/EN
//       ("vino", "barolo", "chardonnay", "caffè", "tiramisù", ecc.).
// - Non c'è feedback loop sui click: la classifica resta deterministica
//   (prezzo crescente entro la categoria suggerita).
// - I pattern sono solo italiano + qualche keyword EN. Localization
//   futura andrebbe estratta in una mappa per `Venue.country`.

import { db } from "@/lib/db";
import { loadUpsellStats, type UpsellStats } from "@/server/upsell-ranking";

// Threshold for switching from price-asc to CTR-weighted ranking. We require
// at least 50 shown events in `RANKING_LOOKBACK_DAYS` so the smoothed CTR
// has real signal across multiple `(reason, menuItemId)` pairs — below that
// the additive prior dominates and we'd just be reshuffling noise.
const RANKING_MIN_SHOWS = 50;
const RANKING_LOOKBACK_DAYS = 60;

export type UpsellReason =
  | "wine_pairing"
  | "white_wine_pairing"
  | "coffee_after"
  | "antipasto"
  | "dessert"
  | "dietary_complement";

export type UpsellHint = {
  reason: UpsellReason;
  message: string;
  suggestedItems: { id: string; name: string; priceCents: number }[];
};

const MIN_MENU_SIZE_FOR_UPSELL = 10;
const MAX_HINTS = 3;
const MAX_ITEMS_PER_HINT = 3;

// Pattern italiani (e qualche EN di backup) per riconoscere "ruoli" del
// piatto quando il nome della categoria non basta. Tutti i match sono
// case-insensitive su `${name} ${description}`.
const PATTERNS = {
  redWine: /(vino\s*rosso|rosso\s+\w+|barolo|barbaresco|chianti|brunello|amarone|nebbiolo|montepulciano|primitivo|merlot|cabernet|sangiovese|nero\s+d['’]avola)/i,
  whiteWine: /(vino\s*bianco|bianco\s+\w+|chardonnay|sauvignon|vermentino|pinot\s*grigio|prosecco|gavi|falanghina|fiano|riesling|gew(ü|u)rztraminer|franciacorta|champagne|spumante)/i,
  anyWine: /(vino|wine|barolo|chianti|chardonnay|sauvignon|prosecco|champagne|spumante|merlot|cabernet)/i,
  hotDrink: /(caff(è|e)|espresso|cappuccino|macchiato|americano|the|t(è|e)\s|tisana|infuso|coffee|tea)/i,
  meatMain: /(bistecca|filetto|tagliata|costata|brasato|ossobuco|agnello|maiale|manzo|vitello|tartare|anatra|cinghiale|carne|beef|steak|lamb|pork)/i,
  pastaMain: /(pasta|spaghetti|tagliatelle|tagliolini|pappardelle|rigatoni|penne|fusilli|gnocchi|risotto|lasagne|ravioli|tortelli|maccheroni|trofie|orecchiette)/i,
  fishMain: /(pesce|branzino|orata|tonno|salmone|spigola|baccal(à|a)|merluzzo|polpo|seppia|gambero|gamberi|scampi|astice|aragosta|vongole|frutti\s+di\s+mare|crudo\s+di\s+pesce|fish|seafood)/i,
  dessert: /(dolce|dessert|tiramis(ù|u)|panna\s*cotta|cheesecake|crostata|sorbetto|gelato|torta|sem|mille\s*foglie|cannolo|profitterol|brownie|babba?|cr(é|e)me\s*brul)/i,
  starter: /(antipasto|antipasti|starter|tartare|carpaccio|bruschett|crud(o|i)|tagliere|tapas|finger\s*food|appetizer)/i,
};

// Categorie tipiche: italian-first. Match su `MenuCategory.name`.
const CATEGORY_PATTERNS = {
  starter: /(antipas|starter|appetizer|entr(é|e)e|aper)/i,
  pasta: /(pasta|primi|risott)/i,
  main: /(second|main|carne|pesce|grill)/i,
  dessert: /(dolc|dessert)/i,
  wine: /(vin(o|i)|wine|cantina|cellar)/i,
  redWine: /(rosso|rossi|red)/i,
  whiteWine: /(bianco|bianchi|white)/i,
  hotDrink: /(caff(è|e)|bevand|drink|hot|bar)/i,
};

// Internal: tagging step. Converts a MenuItem (+ its category name) into
// the set of semantic roles we use for matching.
type Role =
  | "red_wine"
  | "white_wine"
  | "any_wine"
  | "hot_drink"
  | "dessert"
  | "starter"
  | "pasta"
  | "meat"
  | "fish"
  | "main";

type TaggedItem = {
  id: string;
  name: string;
  priceCents: number;
  description: string | null;
  dietary: string[];
  categoryName: string;
  roles: Set<Role>;
};

function classify(item: {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  dietary: string[];
  category: { name: string };
}): TaggedItem {
  const roles = new Set<Role>();
  const haystack = `${item.name} ${item.description ?? ""}`;
  const catName = item.category.name;

  // Wines first — they steal precedence over "main" categorisation.
  if (PATTERNS.redWine.test(haystack) || CATEGORY_PATTERNS.redWine.test(catName)) {
    roles.add("red_wine");
    roles.add("any_wine");
  }
  if (
    PATTERNS.whiteWine.test(haystack) ||
    CATEGORY_PATTERNS.whiteWine.test(catName)
  ) {
    roles.add("white_wine");
    roles.add("any_wine");
  }
  if (
    !roles.has("any_wine") &&
    (PATTERNS.anyWine.test(haystack) || CATEGORY_PATTERNS.wine.test(catName))
  ) {
    roles.add("any_wine");
  }

  if (PATTERNS.hotDrink.test(haystack) || CATEGORY_PATTERNS.hotDrink.test(catName)) {
    roles.add("hot_drink");
  }
  if (PATTERNS.dessert.test(haystack) || CATEGORY_PATTERNS.dessert.test(catName)) {
    roles.add("dessert");
  }
  if (PATTERNS.starter.test(haystack) || CATEGORY_PATTERNS.starter.test(catName)) {
    roles.add("starter");
  }
  if (PATTERNS.pastaMain.test(haystack) || CATEGORY_PATTERNS.pasta.test(catName)) {
    roles.add("pasta");
    roles.add("main");
  }
  if (PATTERNS.meatMain.test(haystack)) {
    roles.add("meat");
    roles.add("main");
  }
  if (PATTERNS.fishMain.test(haystack)) {
    roles.add("fish");
    roles.add("main");
  }
  // Generic "main" fallback if the category screams main.
  if (CATEGORY_PATTERNS.main.test(catName)) {
    roles.add("main");
  }

  return {
    id: item.id,
    name: item.name,
    priceCents: item.priceCents,
    description: item.description,
    dietary: item.dietary,
    categoryName: item.category.name,
    roles,
  };
}

function pickCheapest(
  candidates: TaggedItem[],
  excludeIds: Set<string>,
  limit = MAX_ITEMS_PER_HINT,
) {
  return candidates
    .filter((c) => !excludeIds.has(c.id))
    .sort((a, b) => a.priceCents - b.priceCents)
    .slice(0, limit)
    .map((c) => ({ id: c.id, name: c.name, priceCents: c.priceCents }));
}

// CTR-weighted variant: sort by smoothedCtr desc for the given `reason`,
// falling back to price-asc when an item has no recorded shows.
function pickByCtr(
  candidates: TaggedItem[],
  excludeIds: Set<string>,
  reason: UpsellReason,
  statsByKey: Map<string, UpsellStats>,
  limit = MAX_ITEMS_PER_HINT,
) {
  const scored = candidates
    .filter((c) => !excludeIds.has(c.id))
    .map((c) => {
      const s = statsByKey.get(`${reason}::${c.id}`);
      return {
        item: c,
        smoothedCtr: s?.smoothedCtr ?? 1 / 5, // prior 20% for unseen items
        priceCents: c.priceCents,
      };
    })
    .sort((a, b) => {
      if (b.smoothedCtr !== a.smoothedCtr) return b.smoothedCtr - a.smoothedCtr;
      return a.priceCents - b.priceCents;
    })
    .slice(0, limit);
  return scored.map(({ item }) => ({
    id: item.id,
    name: item.name,
    priceCents: item.priceCents,
  }));
}

export async function suggestUpsells(opts: {
  venueId: string;
  currentItems: { menuItemId: string | null; quantity: number }[];
  useCtrRanking?: boolean;
}): Promise<UpsellHint[]> {
  const venueId = opts.venueId;
  const useCtrRanking = opts.useCtrRanking ?? true;
  const cartIds = new Set(
    opts.currentItems.map((c) => c.menuItemId).filter((x): x is string => !!x),
  );

  // Load whole active menu in one shot (typically < 200 rows per venue).
  // The classifier is cheap so we do it in JS.
  const items = await db.menuItem.findMany({
    where: { venueId, available: true },
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      dietary: true,
      category: { select: { name: true, active: true } },
    },
  });
  const activeItems = items
    .filter((i) => i.category.active)
    .map((i) => classify(i));

  // Guard #1: tiny menu → suggesting feels noisy.
  if (activeItems.length < MIN_MENU_SIZE_FOR_UPSELL) return [];

  const cartItems = activeItems.filter((i) => cartIds.has(i.id));
  if (cartItems.length === 0) return [];

  // Aggregate cart roles for fast checks.
  const cartHas = (role: Role) => cartItems.some((c) => c.roles.has(role));
  const cartHasDietary = (tag: string) =>
    cartItems.some((c) => c.dietary.includes(tag));

  const cartTotalCents = opts.currentItems.reduce((sum, it) => {
    const match = activeItems.find((a) => a.id === it.menuItemId);
    return sum + (match ? match.priceCents * it.quantity : 0);
  }, 0);

  // Try CTR-weighted ranking when enabled. We bail out (and silently fall
  // back to price-asc) on any query error or when the venue is still cold
  // — see RANKING_MIN_SHOWS for the threshold rationale.
  let statsByKey: Map<string, UpsellStats> | null = null;
  if (useCtrRanking) {
    try {
      const stats = await loadUpsellStats(venueId, RANKING_LOOKBACK_DAYS);
      const totalShows = stats.reduce((sum, s) => sum + s.showCount, 0);
      if (totalShows >= RANKING_MIN_SHOWS) {
        statsByKey = new Map<string, UpsellStats>();
        for (const s of stats) {
          statsByKey.set(`${s.reason}::${s.menuItemId}`, s);
        }
      }
    } catch (e) {
      // Fail-open: ranking is a nice-to-have, never block the core flow.
      console.error("[upsell] loadUpsellStats failed, falling back", e);
      statsByKey = null;
    }
  }

  const pick = (
    candidates: TaggedItem[],
    excludeIds: Set<string>,
    reason: UpsellReason,
    limit = MAX_ITEMS_PER_HINT,
  ) =>
    statsByKey
      ? pickByCtr(candidates, excludeIds, reason, statsByKey, limit)
      : pickCheapest(candidates, excludeIds, limit);

  const hints: UpsellHint[] = [];

  // (a) Red wine pairing — meat / pasta-with-meat / generic main, NO wine yet.
  if ((cartHas("meat") || cartHas("pasta") || cartHas("main")) && !cartHas("any_wine")) {
    const reds = pick(
      activeItems.filter((i) => i.roles.has("red_wine")),
      cartIds,
      "wine_pairing",
    );
    if (reds.length > 0) {
      hints.push({
        reason: "wine_pairing",
        message: "Un calice di rosso per accompagnare il piatto principale?",
        suggestedItems: reds,
      });
    }
  }

  // (b) White wine pairing — fish/seafood/vegetarian, NO wine yet.
  const cartIsVegetarian =
    cartHasDietary("VEGETARIAN") || cartHasDietary("VEGAN");
  if (
    (cartHas("fish") || cartIsVegetarian) &&
    !cartHas("any_wine") &&
    !hints.some((h) => h.reason === "wine_pairing")
  ) {
    const whites = pick(
      activeItems.filter((i) => i.roles.has("white_wine")),
      cartIds,
      "white_wine_pairing",
    );
    if (whites.length > 0) {
      hints.push({
        reason: "white_wine_pairing",
        message: "Un bianco fresco per esaltare il pesce o un piatto vegetale?",
        suggestedItems: whites,
      });
    }
  }

  // (c) Coffee after — there's a dessert, no hot drink yet.
  if (cartHas("dessert") && !cartHas("hot_drink")) {
    const drinks = pick(
      activeItems.filter((i) => i.roles.has("hot_drink")),
      cartIds,
      "coffee_after",
    );
    if (drinks.length > 0) {
      hints.push({
        reason: "coffee_after",
        message: "Chiudiamo con un caffè o una tisana dopo il dolce?",
        suggestedItems: drinks,
      });
    }
  }

  // (d) Antipasto missing — at least one main, zero starter.
  if (cartHas("main") && !cartHas("starter")) {
    const starters = pick(
      activeItems.filter((i) => i.roles.has("starter")),
      cartIds,
      "antipasto",
      2,
    );
    if (starters.length > 0) {
      hints.push({
        reason: "antipasto",
        message: "Un antipasto da condividere per iniziare in dolcezza?",
        suggestedItems: starters,
      });
    }
  }

  // (e) Dessert missing — main + cart > 30€ + no dessert yet.
  if (cartHas("main") && cartTotalCents >= 3000 && !cartHas("dessert")) {
    const desserts = pick(
      activeItems.filter((i) => i.roles.has("dessert")),
      cartIds,
      "dessert",
      2,
    );
    if (desserts.length > 0) {
      hints.push({
        reason: "dessert",
        message: "Un piccolo dessert per concludere come si deve?",
        suggestedItems: desserts,
      });
    }
  }

  // (f) Dietary complement — if user picked a VEGAN dish, surface other
  // vegan options so the menu feels consistent (e.g. vegan dessert).
  if (cartHasDietary("VEGAN")) {
    const vegans = pick(
      activeItems.filter(
        (i) =>
          i.dietary.includes("VEGAN") &&
          // avoid duplicating items already proposed in other hints
          !hints.some((h) => h.suggestedItems.some((s) => s.id === i.id)),
      ),
      cartIds,
      "dietary_complement",
    );
    if (vegans.length > 0) {
      hints.push({
        reason: "dietary_complement",
        message: "Altre proposte 100% vegetali per restare in linea con la scelta.",
        suggestedItems: vegans,
      });
    }
  }

  return hints.slice(0, MAX_HINTS);
}
