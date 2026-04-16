// Features subscribe to clock-step transitions by providing a
// PhaseStepListener. The clock itself is phase-agnostic: it does not
// know which features care about which step, only that it fires a
// transition callback. New features (draft, trades, salary cap) plug
// in by appending another listener to the registry in the composition
// root — the clock does not change.
export interface PhaseStepListener {
  onTransition(input: {
    leagueId: string;
    prevStepSlug: string;
    nextStepSlug: string;
  }): Promise<void>;
}

// Composes multiple listeners into one. Listeners run sequentially in
// the order supplied. A listener's rejection aborts the chain — the
// clock treats that as a failed advance and rolls the transaction back,
// so later listeners are not silently skipped.
export function createPhaseStepListenerFanout(
  listeners: readonly PhaseStepListener[],
): PhaseStepListener {
  return {
    async onTransition(input) {
      for (const listener of listeners) {
        await listener.onTransition(input);
      }
    },
  };
}
