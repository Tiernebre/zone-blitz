import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import {
  useExpressInterest,
  useHiringCandidateDetail,
  useHiringCandidates,
  useRequestInterviews,
  useSubmitOffers,
  useTeamHiringState,
} from "./use-hiring.ts";

const mockCandidatesGet = vi.fn();
const mockCandidateDetailGet = vi.fn();
const mockStateGet = vi.fn();
const mockInterestsPost = vi.fn();
const mockInterviewsPost = vi.fn();
const mockOffersPost = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      leagues: {
        ":leagueId": {
          hiring: {
            candidates: {
              $get: (...args: unknown[]) => mockCandidatesGet(...args),
              ":candidateId": {
                $get: (...args: unknown[]) => mockCandidateDetailGet(...args),
              },
            },
            state: {
              $get: (...args: unknown[]) => mockStateGet(...args),
            },
            interests: {
              $post: (...args: unknown[]) => mockInterestsPost(...args),
            },
            interviews: {
              $post: (...args: unknown[]) => mockInterviewsPost(...args),
            },
            offers: {
              $post: (...args: unknown[]) => mockOffersPost(...args),
            },
          },
        },
      },
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useHiringCandidates", () => {
  it("fetches candidates with filter", async () => {
    mockCandidatesGet.mockResolvedValue({
      json: () => Promise.resolve([{ id: "c-1" }]),
    });

    const { result } = renderHook(
      () => useHiringCandidates("lg", { role: "HC", staffType: "coach" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "c-1" }]);
    expect(mockCandidatesGet).toHaveBeenCalledWith({
      param: { leagueId: "lg" },
      query: { role: "HC", staffType: "coach" },
    });
  });

  it("fetches candidates with no filter", async () => {
    mockCandidatesGet.mockResolvedValue({ json: () => Promise.resolve([]) });
    const { result } = renderHook(() => useHiringCandidates("lg"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCandidatesGet).toHaveBeenCalledWith({
      param: { leagueId: "lg" },
      query: { role: undefined, staffType: undefined },
    });
  });

  it("is disabled when leagueId is empty", () => {
    const { result } = renderHook(() => useHiringCandidates(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useHiringCandidateDetail", () => {
  it("returns null on 404", async () => {
    mockCandidateDetailGet.mockResolvedValue({
      status: 404,
      json: () => Promise.resolve({}),
    });
    const { result } = renderHook(
      () => useHiringCandidateDetail("lg", "c-1"),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("returns detail on 200", async () => {
    mockCandidateDetailGet.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: "c-1" }),
    });
    const { result } = renderHook(
      () => useHiringCandidateDetail("lg", "c-1"),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "c-1" });
  });

  it("is disabled when candidateId is empty", () => {
    const { result } = renderHook(
      () => useHiringCandidateDetail("lg", ""),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useTeamHiringState", () => {
  it("returns state on success", async () => {
    mockStateGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ leagueId: "lg" }),
    });
    const { result } = renderHook(() => useTeamHiringState("lg"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ leagueId: "lg" });
  });

  it("throws on non-ok response", async () => {
    mockStateGet.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    const { result } = renderHook(() => useTeamHiringState("lg"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("500");
  });
});

describe("useExpressInterest", () => {
  it("posts interests and returns data on success", async () => {
    mockInterestsPost.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "i-1" }]),
    });
    const { result } = renderHook(() => useExpressInterest(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ leagueId: "lg", candidateIds: ["c-1"] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInterestsPost).toHaveBeenCalledWith({
      param: { leagueId: "lg" },
      json: { candidateIds: ["c-1"] },
    });
  });

  it("throws server message on failure", async () => {
    mockInterestsPost.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: "cap" }),
    });
    const { result } = renderHook(() => useExpressInterest(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ leagueId: "lg", candidateIds: ["c-1"] });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("cap");
  });

  it("throws fallback message when none provided", async () => {
    mockInterestsPost.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    const { result } = renderHook(() => useExpressInterest(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ leagueId: "lg", candidateIds: ["c-1"] });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("500");
  });
});

describe("useRequestInterviews", () => {
  it("posts interviews on success", async () => {
    mockInterviewsPost.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    const { result } = renderHook(() => useRequestInterviews(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ leagueId: "lg", candidateIds: ["c-1"] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("propagates server error", async () => {
    mockInterviewsPost.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: "nope" }),
    });
    const { result } = renderHook(() => useRequestInterviews(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ leagueId: "lg", candidateIds: ["c-1"] });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("nope");
  });

  it("uses fallback message when server omits one", async () => {
    mockInterviewsPost.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    const { result } = renderHook(() => useRequestInterviews(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ leagueId: "lg", candidateIds: ["c-1"] });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("500");
  });
});

describe("useSubmitOffers", () => {
  it("posts offers on success", async () => {
    mockOffersPost.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    const { result } = renderHook(() => useSubmitOffers(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({
      leagueId: "lg",
      offers: [
        {
          candidateId: "c-1",
          salary: 1_000_000,
          contractYears: 2,
          buyoutMultiplier: "0.50",
        },
      ],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("propagates server error", async () => {
    mockOffersPost.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: "budget" }),
    });
    const { result } = renderHook(() => useSubmitOffers(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({
      leagueId: "lg",
      offers: [
        {
          candidateId: "c-1",
          salary: 1_000_000,
          contractYears: 2,
          buyoutMultiplier: "0.50",
        },
      ],
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("budget");
  });

  it("uses fallback message when server omits one", async () => {
    mockOffersPost.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    const { result } = renderHook(() => useSubmitOffers(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({
      leagueId: "lg",
      offers: [
        {
          candidateId: "c-1",
          salary: 1_000_000,
          contractYears: 2,
          buyoutMultiplier: "0.50",
        },
      ],
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("500");
  });
});
