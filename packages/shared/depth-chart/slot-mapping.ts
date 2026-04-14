import type { NeutralBucket } from "../archetypes/neutral-bucket.ts";

const SLOT_TO_BUCKETS: Readonly<Record<string, readonly NeutralBucket[]>> = {
  QB: ["QB"],
  RB: ["RB"],
  FB: ["RB", "TE"],
  WR: ["WR"],
  TE: ["TE"],
  LT: ["OT"],
  LG: ["IOL"],
  C: ["IOL"],
  RG: ["IOL"],
  RT: ["OT"],
  OL: ["OT", "IOL"],
  OLB: ["EDGE", "LB"],
  ILB: ["LB"],
  NT: ["IDL"],
  DE: ["EDGE"],
  DT: ["IDL"],
  EDGE: ["EDGE"],
  DL: ["IDL", "EDGE"],
  LB: ["LB"],
  CB: ["CB"],
  NCB: ["CB"],
  S: ["S"],
  K: ["K"],
  P: ["P"],
  LS: ["LS"],
};

export function eligibleBucketsForSlot(
  slotCode: string,
): readonly NeutralBucket[] {
  return SLOT_TO_BUCKETS[slotCode] ?? [];
}
