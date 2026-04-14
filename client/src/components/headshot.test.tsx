import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Headshot } from "./headshot.tsx";

afterEach(() => {
  cleanup();
});

describe("Headshot", () => {
  it("renders an svg element", () => {
    const { container } = render(<Headshot name="Jane Doe" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("labels the portrait with the subject's name for assistive tech", () => {
    render(<Headshot name="Jane Doe" />);
    expect(screen.getByLabelText("Headshot of Jane Doe")).toBeDefined();
  });

  it("exposes an img role when a name is provided", () => {
    render(<Headshot name="Jane Doe" />);
    expect(screen.getByRole("img", { name: "Headshot of Jane Doe" }))
      .toBeDefined();
  });

  it("hides the portrait from assistive tech when decorative", () => {
    const { container } = render(<Headshot decorative />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("aria-label")).toBeNull();
  });

  it("forwards className to the svg for sizing and theming", () => {
    const { container } = render(
      <Headshot name="Jane Doe" className="size-10 text-muted-foreground" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("size-10");
    expect(svg?.getAttribute("class")).toContain("text-muted-foreground");
  });

  it("uses currentColor so the silhouette inherits the parent text color", () => {
    const { container } = render(<Headshot name="Jane Doe" />);
    const svg = container.querySelector("svg");
    expect(svg?.innerHTML).toContain("currentColor");
  });
});
