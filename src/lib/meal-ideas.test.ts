import { describe, expect, it } from "vitest";
import { buildMealPrompt, parseMealIdeas } from "./meal-ideas";

const json = '[{"title": "Pasta pesto", "ingredients": ["Pasta", "pesto", "pasta"]}]';

describe("parseMealIdeas", () => {
  it("accepts plain, fenced and surrounded JSON", () => {
    expect(parseMealIdeas(json)).toEqual([{ title: "Pasta pesto", ingredients: ["Pasta", "pesto"] }]);
    expect(parseMealIdeas("```json\n" + json + "\n```")).toHaveLength(1);
    expect(parseMealIdeas("Hier: " + json + " Smakelijk!")).toHaveLength(1);
  });

  it("returns at most 3 ideas", () => {
    const many = JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ title: `m${i}`, ingredients: [] })));
    expect(parseMealIdeas(many)).toHaveLength(3);
  });

  it("returns null for bad input", () => {
    expect(parseMealIdeas("[nope")).toBeNull();
    expect(parseMealIdeas("[]")).toBeNull();
    expect(parseMealIdeas('[{"ingredients": []}]')).toBeNull();
    expect(parseMealIdeas('{"title": "x", "ingredients": []}')).toBeNull();
    expect(parseMealIdeas("geen json")).toBeNull();
  });
});

describe("buildMealPrompt", () => {
  it("lists the items once", () => {
    const p = buildMealPrompt(["Pasta", "pasta", "Tomaat"]);
    expect(p).toContain("Pasta, Tomaat");
    expect(p.split("Pasta").length - 1).toBe(1);
  });

  it("handles an empty pantry", () => {
    expect(buildMealPrompt([])).toContain("niets bijzonders");
  });
});
