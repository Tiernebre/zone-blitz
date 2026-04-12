import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app.tsx";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("./api.ts", () => ({
  api: {
    api: {
      leagues: {
        $get: (...args: unknown[]) => mockGet(...args),
        $post: (...args: unknown[]) => mockPost(...args),
      },
    },
  },
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App", () => {
  it("renders the Zone Blitz heading", () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    expect(
      screen.getByRole("heading", { name: "Zone Blitz" }),
    ).toBeDefined();
  });

  it("renders the tagline", () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    expect(screen.getByText(/football franchise simulation/i)).toBeDefined();
  });

  it("shows loading state while fetching leagues", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    expect(screen.getByText("Loading leagues...")).toBeDefined();
  });

  it("shows error state when fetch fails", async () => {
    mockGet.mockReturnValue(Promise.reject(new Error("network error")));
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Failed to load leagues")).toBeDefined();
    });
  });

  it("shows empty state when no leagues exist", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });
  });

  it("renders a list of leagues", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({
        json: () =>
          Promise.resolve([
            { id: 1, name: "NFL League" },
            { id: 2, name: "XFL League" },
          ]),
      }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("NFL League")).toBeDefined();
      expect(screen.getByText("XFL League")).toBeDefined();
    });
  });

  it("submits the create league form", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    mockPost.mockReturnValue(
      Promise.resolve({
        json: () => Promise.resolve({ id: 3, name: "New League" }),
      }),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    const input = screen.getByPlaceholderText("League name...");
    fireEvent.change(input, { target: { value: "New League" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({ json: { name: "New League" } });
    });
  });

  it("does not submit when input is empty", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("does not submit when input is only whitespace", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    const input = screen.getByPlaceholderText("League name...");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("shows Creating... text while mutation is pending", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    mockPost.mockReturnValue(new Promise(() => {}));
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    const input = screen.getByPlaceholderText("League name...");
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.getByText("Creating...")).toBeDefined();
    });
  });
});
