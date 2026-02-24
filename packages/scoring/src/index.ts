import type { ListingCard, NormalizedFilters } from "@fyn/domain";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesCityScope(listing: ListingCard, city: string): boolean {
  const normalizedCity = normalizeText(city);
  if (!normalizedCity) {
    return false;
  }

  const normalizedListingCity = normalizeText(listing.city);
  if (normalizedListingCity) {
    if (normalizedListingCity === normalizedCity) {
      return true;
    }

    return new RegExp(`\\b${escapeRegex(normalizedCity)}\\b`, "i").test(normalizedListingCity);
  }

  const citySlug = slugify(city);
  if (!citySlug) {
    return false;
  }

  const sourcePath =
    listing.raw && typeof listing.raw.source_path === "string"
      ? listing.raw.source_path.toLowerCase()
      : "";
  return sourcePath.includes(`${citySlug}_capital`);
}

function matchesHardConstraints(listing: ListingCard, criteria: NormalizedFilters): boolean {
  const strict = criteria.strict_constraints ?? true;

  if (criteria.max_price_eur !== undefined) {
    if (listing.price_eur === null) {
      if (strict) {
        return false;
      }
    } else if (listing.price_eur > criteria.max_price_eur) {
      return false;
    }
  }

  if (criteria.min_rooms !== undefined) {
    if (listing.rooms === null) {
      if (strict) {
        return false;
      }
    } else if (listing.rooms < criteria.min_rooms) {
      return false;
    }
  }

  if (criteria.min_capacity_people !== undefined) {
    if (listing.capacity_people === null || listing.capacity_people === undefined) {
      return false;
    }

    if (listing.capacity_people < criteria.min_capacity_people) {
      return false;
    }
  }

  if (criteria.property_types.length > 0 && listing.property_type) {
    if (!criteria.property_types.includes(listing.property_type)) {
      return false;
    }
  } else if (criteria.property_types.length > 0 && listing.property_type === null && strict) {
    return false;
  }

  if (criteria.city && !criteria.nearby_towns) {
    if (!matchesCityScope(listing, criteria.city)) {
      return false;
    }
  }

  return true;
}

function readRawChars(listing: ListingCard): string[] {
  const chars = listing.raw?.chars;
  if (!Array.isArray(chars)) {
    return [];
  }

  return chars.filter((value): value is string => typeof value === "string");
}

function combinedText(listing: ListingCard): string {
  return [listing.description ?? "", ...readRawChars(listing)].join(" ");
}

function extractFloor(listing: ListingCard): number | null {
  for (const item of readRawChars(listing)) {
    if (/\b(bajo|ground floor)\b/i.test(item)) {
      return 0;
    }

    const match = item.match(/(\d+)[ªa]?\s*planta/i);
    if (!match?.[1]) {
      continue;
    }

    const floor = Number(match[1]);
    if (Number.isFinite(floor)) {
      return floor;
    }
  }

  return null;
}

function hasLightIntent(criteria: NormalizedFilters): boolean {
  const wanted = new Set(criteria.tags.map((tag) => tag.toLowerCase()));
  return ["natural_light", "exterior", "large_windows", "good_orientation"].some((tag) =>
    wanted.has(tag)
  );
}

function scoreListing(listing: ListingCard, criteria: NormalizedFilters): ListingCard {
  const why: string[] = [];
  let score = 45;

  if (criteria.city && matchesCityScope(listing, criteria.city)) {
    score += 20;
    why.push("City exact match");
  } else if (criteria.city && criteria.nearby_towns) {
    score += 8;
    why.push("Nearby towns accepted");
  }

  if (criteria.max_price_eur && listing.price_eur) {
    const ratio = 1 - listing.price_eur / criteria.max_price_eur;
    score += Math.max(0, Math.min(15, Math.round(ratio * 15)));
    why.push("Within budget");
  }

  if (criteria.min_rooms && listing.rooms) {
    const roomDelta = listing.rooms - criteria.min_rooms;
    if (roomDelta >= 0) {
      score += Math.min(10, roomDelta * 2 + 4);
      why.push("Rooms requirement satisfied");
    }
  }

  if (criteria.min_capacity_people !== undefined && listing.capacity_people !== null && listing.capacity_people !== undefined) {
    score += 8;
    why.push("Capacity requirement satisfied");
  }

  if (criteria.tags.length > 0) {
    const listingTags = new Set((listing.tags ?? []).map((tag) => tag.toLowerCase()));
    const matchedTags = criteria.tags.filter((tag) => listingTags.has(tag.toLowerCase()));

    if (matchedTags.length > 0) {
      score += matchedTags.length * 4;
      why.push(`Tag matches: ${matchedTags.join(", ")}`);
    }
  }

  // Break ties in broad exploratory searches where many listings share the same tag-only score.
  score += Math.min(4, Math.floor(listing.image_urls.length / 2));
  if (criteria.min_rooms === undefined && listing.rooms !== null) {
    score += Math.min(3, Math.max(0, listing.rooms - 2));
  }

  if (hasLightIntent(criteria)) {
    const text = combinedText(listing);
    const floor = extractFloor(listing);

    if (floor !== null && floor >= 5) {
      score += 6;
      why.push(`High floor (${floor}ª) supports natural light`);
    }

    if (/\b(exterior|outside[- ]facing|toda exterior|todo exterior)\b/i.test(text)) {
      score += 6;
      why.push("Exterior layout mention");
    }

    if (/(luz natural|natural light|luminos[oa]s?|bright|well[- ]lit|solead[oa])/i.test(text)) {
      score += 5;
      why.push("Natural light / bright description");
    }

    if (/(ventanales?|large windows|big windows)/i.test(text)) {
      score += 4;
      why.push("Large windows mention");
    }

    if (/(orientaci[oó]n|south[- ]facing|east[- ]facing|west[- ]facing)/i.test(text)) {
      score += 4;
      why.push("Orientation signal present");
    }
  }

  if (criteria.prefer_exterior && /\b(exterior|outside[- ]facing|toda exterior|todo exterior)\b/i.test(combinedText(listing))) {
    score += 5;
    why.push("Exterior preference satisfied");
  }

  const listingFloor = extractFloor(listing);
  if (criteria.min_floor !== undefined && listingFloor !== null && listingFloor >= criteria.min_floor) {
    score += 2;
    why.push(`Floor requirement satisfied (${listingFloor}ª)`);
  }

  if (criteria.renovation_ok && /(reform|renov|renovar)/i.test(listing.description ?? "")) {
    score += 3;
    why.push("Renovation-friendly description");
  }

  return {
    ...listing,
    score: Math.max(0, Math.min(100, score)),
    why_matched: why
  };
}

function compareListings(a: ListingCard, b: ListingCard): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  const aPrice = a.price_eur ?? Number.MAX_SAFE_INTEGER;
  const bPrice = b.price_eur ?? Number.MAX_SAFE_INTEGER;
  if (aPrice !== bPrice) {
    return aPrice - bPrice;
  }

  const aRooms = a.rooms ?? -1;
  const bRooms = b.rooms ?? -1;
  if (bRooms !== aRooms) {
    return bRooms - aRooms;
  }

  const aSeen = Date.parse(a.last_seen_at);
  const bSeen = Date.parse(b.last_seen_at);
  if (Number.isFinite(aSeen) && Number.isFinite(bSeen) && bSeen !== aSeen) {
    return bSeen - aSeen;
  }

  return a.canonical_id.localeCompare(b.canonical_id);
}

export function rankListings(listings: ListingCard[], criteria: NormalizedFilters): ListingCard[] {
  return listings
    .filter((listing) => {
      const floor = extractFloor(listing);
      if (criteria.exclude_ground_floor && floor === 0) {
        return false;
      }

      if (criteria.min_floor !== undefined) {
        if (floor === null) {
          if (criteria.strict_constraints ?? true) {
            return false;
          }
        } else if (floor < criteria.min_floor) {
          return false;
        }
      }

      return matchesHardConstraints(listing, criteria);
    })
    .map((listing) => scoreListing(listing, criteria))
    .sort(compareListings);
}
