import type { NeutralBucket } from "../archetypes/neutral-bucket.ts";
import { eligibleBucketsForSlot } from "./slot-mapping.ts";
import type { DepthChartSlotDefinition } from "./vocabulary.ts";

export interface PlayerForAssignment {
  id: string;
  neutralBucket: NeutralBucket;
  score: number;
}

export interface DepthChartAssignment {
  playerId: string;
  slotCode: string;
  slotOrdinal: number;
  isInactive: boolean;
}

export function assignDepthChart(
  players: readonly PlayerForAssignment[],
  vocabulary: readonly DepthChartSlotDefinition[],
): DepthChartAssignment[] {
  if (players.length === 0) return [];

  const vocabCodes = vocabulary.map((v) => v.code);

  const bucketToSlots = new Map<NeutralBucket, string[]>();
  for (const code of vocabCodes) {
    for (const bucket of eligibleBucketsForSlot(code)) {
      if (!bucketToSlots.has(bucket)) bucketToSlots.set(bucket, []);
      bucketToSlots.get(bucket)!.push(code);
    }
  }

  const playersByBucket = new Map<NeutralBucket, PlayerForAssignment[]>();
  for (const p of players) {
    if (!playersByBucket.has(p.neutralBucket)) {
      playersByBucket.set(p.neutralBucket, []);
    }
    playersByBucket.get(p.neutralBucket)!.push(p);
  }
  for (const group of playersByBucket.values()) {
    group.sort((a, b) => b.score - a.score);
  }

  const slotCounts = new Map<string, number>();
  for (const code of vocabCodes) {
    slotCounts.set(code, 0);
  }

  const assignments: DepthChartAssignment[] = [];
  const assigned = new Set<string>();

  for (const [bucket, group] of playersByBucket) {
    const slots = bucketToSlots.get(bucket);
    if (!slots || slots.length === 0) continue;

    for (const p of group) {
      let targetSlot = slots[0];
      let minCount = slotCounts.get(slots[0]) ?? 0;
      for (let i = 1; i < slots.length; i++) {
        const count = slotCounts.get(slots[i]) ?? 0;
        if (count < minCount) {
          minCount = count;
          targetSlot = slots[i];
        }
      }

      const ordinal = (slotCounts.get(targetSlot) ?? 0) + 1;
      assignments.push({
        playerId: p.id,
        slotCode: targetSlot,
        slotOrdinal: ordinal,
        isInactive: false,
      });
      slotCounts.set(targetSlot, ordinal);
      assigned.add(p.id);
    }
  }

  for (const p of players) {
    if (assigned.has(p.id)) continue;
    const fallbackSlot = vocabCodes[0] ?? "RES";
    const ordinal = (slotCounts.get(fallbackSlot) ?? 0) + 1;
    assignments.push({
      playerId: p.id,
      slotCode: fallbackSlot,
      slotOrdinal: ordinal,
      isInactive: true,
    });
    slotCounts.set(fallbackSlot, ordinal);
  }

  return assignments;
}
