// RNG
export {
  createRng,
  createSeededRng,
  deriveGameSeed,
  mulberry32,
  triangularInt,
} from "./rng/mod.ts";
export type { SeededRng } from "./rng/mod.ts";

// Math
export { clamp, distributeByWeight, intInRange } from "./math/mod.ts";
export type { WeightedKey } from "./math/mod.ts";

// Errors
export { DomainError } from "./errors/domain-error.ts";
