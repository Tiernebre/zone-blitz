import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile.ts";

function setupMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = [];
  const mql = {
    matches,
    addEventListener: (_event: string, cb: () => void) => {
      listeners.push(cb);
    },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
  return { mql, listeners };
}

describe("useIsMobile", () => {
  it("returns true when viewport is below mobile breakpoint", () => {
    vi.stubGlobal("innerWidth", 500);
    setupMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("returns false when viewport is at or above mobile breakpoint", () => {
    vi.stubGlobal("innerWidth", 1024);
    setupMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it("updates when the media query change fires", () => {
    vi.stubGlobal("innerWidth", 1024);
    const { listeners } = setupMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    vi.stubGlobal("innerWidth", 500);
    act(() => {
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);
  });

  it("removes the listener on unmount", () => {
    vi.stubGlobal("innerWidth", 1024);
    const { mql } = setupMatchMedia(false);

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});
