import { assertEquals } from "@std/assert";
import { eligibleBucketsForSlot } from "./slot-mapping.ts";

Deno.test("eligibleBucketsForSlot: QB slot accepts QB bucket", () => {
  assertEquals(eligibleBucketsForSlot("QB"), ["QB"]);
});

Deno.test("eligibleBucketsForSlot: FB slot accepts RB and TE buckets", () => {
  assertEquals(eligibleBucketsForSlot("FB"), ["RB", "TE"]);
});

Deno.test("eligibleBucketsForSlot: OL slot accepts OT and IOL buckets", () => {
  assertEquals(eligibleBucketsForSlot("OL"), ["OT", "IOL"]);
});

Deno.test("eligibleBucketsForSlot: LT slot accepts only OT bucket", () => {
  assertEquals(eligibleBucketsForSlot("LT"), ["OT"]);
});

Deno.test("eligibleBucketsForSlot: IOL positions map correctly", () => {
  assertEquals(eligibleBucketsForSlot("LG"), ["IOL"]);
  assertEquals(eligibleBucketsForSlot("C"), ["IOL"]);
  assertEquals(eligibleBucketsForSlot("RG"), ["IOL"]);
});

Deno.test("eligibleBucketsForSlot: OLB accepts EDGE and LB buckets", () => {
  assertEquals(eligibleBucketsForSlot("OLB"), ["EDGE", "LB"]);
});

Deno.test("eligibleBucketsForSlot: DL slot accepts IDL and EDGE", () => {
  assertEquals(eligibleBucketsForSlot("DL"), ["IDL", "EDGE"]);
});

Deno.test("eligibleBucketsForSlot: NCB accepts CB bucket", () => {
  assertEquals(eligibleBucketsForSlot("NCB"), ["CB"]);
});

Deno.test("eligibleBucketsForSlot: special teams slots map 1:1", () => {
  assertEquals(eligibleBucketsForSlot("K"), ["K"]);
  assertEquals(eligibleBucketsForSlot("P"), ["P"]);
  assertEquals(eligibleBucketsForSlot("LS"), ["LS"]);
});

Deno.test("eligibleBucketsForSlot: unknown slot returns empty", () => {
  assertEquals(eligibleBucketsForSlot("UNKNOWN"), []);
});
