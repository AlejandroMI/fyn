import { describe, expect, it } from "vitest";

import { normalizeSearchInput } from "../src/index.js";

describe("normalizeSearchInput", () => {
  it("extracts canonical filters from English", () => {
    const result = normalizeSearchInput({
      query_text: "We are looking for a flat in Valencia with at least three rooms. Max 350k"
    });

    expect(result.criteria.city).toBe("Valencia");
    expect(result.criteria.property_types).toContain("flat");
    expect(result.criteria.min_rooms).toBe(3);
    expect(result.criteria.max_price_eur).toBe(350_000);
  });

  it("extracts canonical filters from Spanish", () => {
    const result = normalizeSearchInput({
      query_text: "Buscamos un piso en Valencia con al menos tres habitaciones y máximo 350k"
    });

    expect(result.criteria.locale).toBe("es");
    expect(result.criteria.city).toBe("Valencia");
    expect(result.criteria.property_types).toContain("flat");
    expect(result.criteria.min_rooms).toBe(3);
    expect(result.criteria.max_price_eur).toBe(350_000);
  });

  it("flags broad searches", () => {
    const result = normalizeSearchInput({ query_text: "Show me something nice" });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("extracts office capacity constraints", () => {
    const result = normalizeSearchInput({
      query_text: "Find me an office for +50 people in Valencia"
    });

    expect(result.criteria.property_types).toContain("office");
    expect(result.criteria.min_capacity_people).toBe(50);
  });

  it("maps natural-light intent without misclassifying as nature", () => {
    const result = normalizeSearchInput({
      query_text: "Good natural light, bright, exterior, large windows or good orientation in Valencia"
    });

    expect(result.criteria.tags).toContain("natural_light");
    expect(result.criteria.tags).toContain("exterior");
    expect(result.criteria.tags).toContain("large_windows");
    expect(result.criteria.tags).toContain("good_orientation");
    expect(result.criteria.tags).not.toContain("nature");
  });

  it("extracts bedrooms constraints in English", () => {
    const result = normalizeSearchInput({
      query_text: "Find me a flat in Valencia with at least 3 bedrooms"
    });

    expect(result.criteria.min_rooms).toBe(3);
  });
});
