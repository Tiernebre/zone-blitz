import { describe, expect, it } from "vitest";
import { blendHex, readableTextColor } from "./readable-text-color.ts";

describe("readableTextColor", () => {
  it("returns white text on a dark gradient", () => {
    expect(readableTextColor("#3a0f0f", "#7a1a1a")).toBe("#ffffff");
  });

  it("returns black text on a light gradient", () => {
    expect(readableTextColor("#ffe082", "#fff59d")).toBe("#000000");
  });

  it("returns white text for the Honolulu Lava dark-red gradient", () => {
    expect(readableTextColor("#3d0f0a", "#a12a12")).toBe("#ffffff");
  });

  it("accepts 3-digit hex shorthand", () => {
    expect(readableTextColor("#000", "#111")).toBe("#ffffff");
    expect(readableTextColor("#fff", "#eee")).toBe("#000000");
  });

  it("picks the color with the higher minimum contrast across both endpoints", () => {
    expect(readableTextColor("#000000", "#ffffff")).toMatch(
      /^#(000000|ffffff)$/,
    );
  });

  it("is case-insensitive for hex input", () => {
    expect(readableTextColor("#3D0F0A", "#A12A12")).toBe("#ffffff");
  });
});

describe("blendHex", () => {
  it("returns the base color when overlay alpha is 0", () => {
    expect(blendHex("#ff8800", "#000000", 0)).toBe("#ff8800");
  });

  it("returns the overlay color when alpha is 1", () => {
    expect(blendHex("#ff8800", "#000000", 1)).toBe("#000000");
  });

  it("darkens a base color when blended with black at 20% alpha", () => {
    expect(blendHex("#ffffff", "#000000", 0.2)).toBe("#cccccc");
  });

  it("clamps alpha to the [0, 1] range", () => {
    expect(blendHex("#ffffff", "#000000", -1)).toBe("#ffffff");
    expect(blendHex("#ffffff", "#000000", 2)).toBe("#000000");
  });

  it("accepts shorthand hex for base and overlay", () => {
    expect(blendHex("#fff", "#000", 0.5)).toBe("#808080");
  });
});
