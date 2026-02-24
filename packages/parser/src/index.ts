import type {
  Locale,
  NormalizedFilters,
  PropertyType,
  SearchInput,
  TransactionType
} from "@fyn/domain";

const KNOWN_CITIES = [
  "valencia",
  "madrid",
  "barcelona",
  "sevilla",
  "malaga",
  "alicante",
  "zaragoza",
  "bilbao"
] as const;

const ROOM_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  una: 1,
  un: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6
};

function detectLocale(text: string): Locale {
  const spanishSignal = /(\b(busco|quiero|piso|casa|habitaciones|cerca|reforma|comprar|alquiler)\b)/i;
  return spanishSignal.test(text) ? "es" : "en";
}

function extractPropertyTypes(text: string): PropertyType[] {
  const found: PropertyType[] = [];
  if (/(\b(flat|apartment|piso)\b)/i.test(text)) found.push("flat");
  if (/(\b(house|home|casa|chalet)\b)/i.test(text)) found.push("house");
  if (/(\b(office|oficina)\b)/i.test(text)) found.push("office");
  if (/(\b(land|plot|solar|terreno)\b)/i.test(text)) found.push("land");
  return Array.from(new Set(found));
}

function extractPrice(text: string): number | undefined {
  const patterns = [
    /(?:max|maximo|máximo|hasta)\D*(\d+(?:[.,]\d+)?)(\s*[km])?/i,
    /(?:under|below)\D*(\d+(?:[.,]\d+)?)(\s*[km])?/i,
    /(\d+(?:[.,]\d+)?)(\s*[km])\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const numericToken = match[1];
    if (!numericToken) continue;

    const numericPart = Number(numericToken.replace(",", "."));
    const scale = (match[2] || "").toLowerCase().trim();

    if (Number.isNaN(numericPart)) continue;

    if (scale === "k") return Math.round(numericPart * 1_000);
    if (scale === "m") return Math.round(numericPart * 1_000_000);
    return Math.round(numericPart);
  }

  return undefined;
}

function extractRooms(text: string): number | undefined {
  const digitMatch = text.match(/(?:at\s+least|min(?:imum)?|al\s+menos)\D*(\d+)\s*(?:rooms|habitaciones|dormitorios?)/i)
    || text.match(/(\d+)\s*(?:rooms|habitaciones|dormitorios?)/i);

  if (digitMatch) {
    return Number(digitMatch[1]);
  }

  const wordMatch = text.match(/(one|two|three|four|five|six|una|un|dos|tres|cuatro|cinco|seis)\s*(?:rooms|habitaciones|dormitorios?)/i);
  if (!wordMatch) {
    return undefined;
  }

  const token = wordMatch[1];
  if (!token) {
    return undefined;
  }

  return ROOM_WORDS[token.toLowerCase()];
}

function extractMinCapacityPeople(text: string): number | undefined {
  const patterns = [
    /(?:at\s+least|min(?:imum)?|m[aá]s\s+de|al\s+menos)\s*(\d+)\s*(?:people|personas|puestos?|seats?)/i,
    /\+\s*(\d+)\s*(?:people|personas|puestos?|seats?)/i,
    /(\d+)\s*\+\s*(?:people|personas|puestos?|seats?)/i,
    /(\d+)\s*(?:people|personas|puestos?|seats?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function extractCity(text: string): string | undefined {
  for (const city of KNOWN_CITIES) {
    if (new RegExp(`\\b${city}\\b`, "i").test(text)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }

  const generic = text.match(/(?:in|en)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/i);
  if (!generic) {
    return undefined;
  }

  const segment = generic[1];
  if (!segment) {
    return undefined;
  }

  const raw = segment.trim();
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function extractTransactionType(text: string): TransactionType | undefined {
  if (/(\b(rent|rental|alquiler)\b)/i.test(text)) {
    return "rent";
  }

  if (/(\b(buy|purchase|comprar|compra|build|construir)\b)/i.test(text)) {
    return "buy";
  }

  return undefined;
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  if (/(\b(nature|natural|naturaleza)\b)/i.test(text)) tags.push("nature");
  if (/(\b(views|vistas|view)\b)/i.test(text)) tags.push("views");
  if (/(\b(retreat|retiro|retiros)\b)/i.test(text)) tags.push("retreat");
  if (/(\b(renovation|renovations|reforma|reformas)\b)/i.test(text)) tags.push("renovation");
  return tags;
}

function mergePropertyTypes(a: PropertyType[], b: PropertyType[] | undefined): PropertyType[] {
  return Array.from(new Set([...(a || []), ...(b || [])]));
}

export function normalizeSearchInput(input: SearchInput): { criteria: NormalizedFilters; warnings: string[] } {
  const query = input.query_text ?? "";
  const warnings: string[] = [];

  const detectedLocale = input.locale ?? detectLocale(query);
  const derivedCity = extractCity(query);
  const derivedRooms = extractRooms(query);
  const derivedPrice = extractPrice(query);
  const derivedTypes = extractPropertyTypes(query);
  const derivedTransaction = extractTransactionType(query);
  const derivedTags = extractTags(query);
  const derivedCapacity = extractMinCapacityPeople(query);

  const nearbyTowns =
    input.nearby_towns
    ?? /(nearby towns|nearby|close towns|pueblos cercanos|alrededores|cerca de)/i.test(query);

  const renovationOk = input.renovation_ok ?? /(renovation|reformas?|to renovate)/i.test(query);
  const resolvedTransaction = input.transaction_type ?? derivedTransaction;
  const resolvedCity = input.city ?? derivedCity;
  const resolvedRooms = input.min_rooms ?? derivedRooms;
  const resolvedCapacity = input.min_capacity_people ?? derivedCapacity;
  const resolvedPrice = input.max_price_eur ?? derivedPrice;

  const criteria: NormalizedFilters = {
    locale: detectedLocale,
    property_types: mergePropertyTypes(derivedTypes, input.property_types),
    nearby_towns: nearbyTowns,
    renovation_ok: renovationOk,
    tags: Array.from(new Set([...(input.tags ?? []), ...derivedTags])),
    ...(resolvedTransaction ? { transaction_type: resolvedTransaction } : {}),
    ...(resolvedCity ? { city: resolvedCity } : {}),
    ...(resolvedRooms !== undefined ? { min_rooms: resolvedRooms } : {}),
    ...(resolvedCapacity !== undefined ? { min_capacity_people: resolvedCapacity } : {}),
    ...(resolvedPrice !== undefined ? { max_price_eur: resolvedPrice } : {}),
    ...(input.query_text ? { original_query: input.query_text } : {})
  };

  if (!criteria.city) {
    warnings.push("No city detected; results may be broad.");
  }

  if (!criteria.transaction_type) {
    warnings.push("No transaction type detected; defaulting to broad portal search.");
  }

  if (criteria.property_types.length === 0) {
    warnings.push("No property type detected; querying all property types.");
  }

  return { criteria, warnings };
}
