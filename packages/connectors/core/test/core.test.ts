import { describe, expect, it } from "vitest";

import { parseRoomsFromText, stripTags } from "../src/index.js";

describe("connector text helpers", () => {
  it("strips markup and decodes entities", () => {
    expect(stripTags("<p>Piso &amp; ático</p><br>luminoso")).toBe("Piso & ático luminoso");
  });

  it.each([
    ["Piso con 3 habitaciones", 3],
    ["4 habs. y terraza", 4],
    ["Apartment with 2 rooms", 2],
    ["Dormitorio sin número", null],
    ["Referencia 123roommate", null]
  ])("parses room counts from %s", (input, expected) => {
    expect(parseRoomsFromText(input)).toBe(expected);
  });
});
