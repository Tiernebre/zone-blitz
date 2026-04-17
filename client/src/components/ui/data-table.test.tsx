import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { afterEach, describe, expect, it } from "vitest";
import {
  DataTable,
  multiSelectFilterFn,
  rangeFilterFn,
  SortableHeader,
} from "./data-table.tsx";

type Row = { id: string; name: string; value: number; color: string };

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const data: Row[] = [
  { id: "a", name: "Alpha", value: 2, color: "red" },
  { id: "b", name: "Beta", value: 1, color: "blue" },
];

afterEach(cleanup);

describe("DataTable", () => {
  it("renders a header cell per column", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Value" })).toBeDefined();
  });

  it("renders a row per data entry with cell values", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
  });

  it("shows an empty-state row when data is empty", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText(/no results/i)).toBeDefined();
  });

  it("renders a custom emptyMessage when provided", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="Nothing here yet."
      />,
    );
    expect(screen.getByText("Nothing here yet.")).toBeDefined();
  });

  it("applies a row data-testid from the getRowTestId prop", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
      />,
    );
    const row = screen.getByTestId("row-a");
    expect(within(row).getByText("Alpha")).toBeDefined();
  });

  it("sorts rows ascending then descending when a SortableHeader is clicked", () => {
    const sortableColumns: ColumnDef<Row>[] = [
      {
        accessorKey: "value",
        header: ({ column }) => (
          <SortableHeader column={column}>Value</SortableHeader>
        ),
      },
      { accessorKey: "name", header: "Name" },
    ];
    render(
      <DataTable
        columns={sortableColumns}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
      />,
    );
    const orderedIds = () =>
      Array.from(document.querySelectorAll("tbody tr"))
        .map((r) => r.getAttribute("data-testid"));

    expect(orderedIds()).toEqual(["row-a", "row-b"]);
    fireEvent.click(screen.getByRole("button", { name: /value/i }));
    expect(orderedIds()).toEqual(["row-b", "row-a"]);
    fireEvent.click(screen.getByRole("button", { name: /value/i }));
    expect(orderedIds()).toEqual(["row-a", "row-b"]);
  });

  it("renders a custom toolbar and filters rows via the global filter", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
        toolbar={(table) => (
          <input
            aria-label="search"
            value={(table.getState().globalFilter as string) ?? ""}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        )}
      />,
    );
    expect(screen.getByTestId("row-a")).toBeDefined();
    expect(screen.getByTestId("row-b")).toBeDefined();
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "Alpha" },
    });
    expect(screen.getByTestId("row-a")).toBeDefined();
    expect(screen.queryByTestId("row-b")).toBeNull();
  });

  it("filters rows via the built-in global search input", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
        enableGlobalFilter
        testIdPrefix="grid"
      />,
    );
    fireEvent.change(screen.getByTestId("grid-search"), {
      target: { value: "Beta" },
    });
    expect(screen.queryByTestId("row-a")).toBeNull();
    expect(screen.getByTestId("row-b")).toBeDefined();
    expect(screen.getByTestId("grid-result-count").textContent).toContain(
      "1 of 2",
    );
  });

  it("toggles the column-filter row when the Filters button is clicked", () => {
    const cols: ColumnDef<Row>[] = [
      {
        accessorKey: "name",
        header: "Name",
        meta: { filterVariant: "text" },
      },
      { accessorKey: "value", header: "Value" },
    ];
    render(
      <DataTable
        columns={cols}
        data={data}
        enableColumnFilters
        testIdPrefix="grid"
      />,
    );
    expect(screen.queryByTestId("grid-filter-row")).toBeNull();
    fireEvent.click(screen.getByTestId("grid-toggle-filters"));
    expect(screen.getByTestId("grid-filter-row")).toBeDefined();
  });

  it("filters rows via a per-column text filter", () => {
    const cols: ColumnDef<Row>[] = [
      {
        accessorKey: "name",
        header: "Name",
        meta: { filterVariant: "text", filterPlaceholder: "Search name" },
      },
      { accessorKey: "value", header: "Value" },
    ];
    render(
      <DataTable
        columns={cols}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
        enableColumnFilters
        initiallyShowColumnFilters
        testIdPrefix="grid"
      />,
    );
    fireEvent.change(screen.getByTestId("grid-filter-name"), {
      target: { value: "Alp" },
    });
    expect(screen.getByTestId("row-a")).toBeDefined();
    expect(screen.queryByTestId("row-b")).toBeNull();
    fireEvent.change(screen.getByTestId("grid-filter-name"), {
      target: { value: "" },
    });
    expect(screen.getByTestId("row-b")).toBeDefined();
  });

  it("filters rows via a per-column range filter (min and max)", () => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "value",
        header: "Value",
        meta: { filterVariant: "range" },
      },
    ];
    render(
      <DataTable
        columns={cols}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
        enableColumnFilters
        initiallyShowColumnFilters
        testIdPrefix="grid"
      />,
    );
    fireEvent.change(screen.getByTestId("grid-filter-value-min"), {
      target: { value: "2" },
    });
    expect(screen.queryByTestId("row-b")).toBeNull();
    expect(screen.getByTestId("row-a")).toBeDefined();
    fireEvent.change(screen.getByTestId("grid-filter-value-min"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByTestId("grid-filter-value-max"), {
      target: { value: "1" },
    });
    expect(screen.queryByTestId("row-a")).toBeNull();
    expect(screen.getByTestId("row-b")).toBeDefined();
  });

  it("filters rows via a per-column multi-select filter", async () => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "color",
        header: "Color",
        meta: {
          filterVariant: "multi-select",
          filterFormatLabel: (v) => v.toUpperCase(),
        },
      },
    ];
    render(
      <DataTable
        columns={cols}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
        enableColumnFilters
        initiallyShowColumnFilters
        testIdPrefix="grid"
      />,
    );
    fireEvent.click(screen.getByTestId("grid-filter-color"));
    fireEvent.click(
      await screen.findByTestId("grid-filter-color-option-red"),
    );
    await waitFor(() => {
      expect(screen.queryByTestId("row-b")).toBeNull();
      expect(screen.getByTestId("row-a")).toBeDefined();
    });
    // Toggling the same option clears the selection
    fireEvent.click(
      await screen.findByTestId("grid-filter-color-option-red"),
    );
    await waitFor(() => {
      expect(screen.getByTestId("row-b")).toBeDefined();
    });
  });

  it("uses fixed filterOptions when provided instead of faceted values", async () => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "color",
        header: "Color",
        meta: {
          filterVariant: "select",
          filterOptions: [
            { value: "red", label: "Red" },
            { value: "green", label: "Green (no rows)" },
          ],
        },
      },
    ];
    render(
      <DataTable
        columns={cols}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
        enableColumnFilters
        initiallyShowColumnFilters
        testIdPrefix="grid"
      />,
    );
    fireEvent.click(screen.getByTestId("grid-filter-color"));
    expect(
      await screen.findByTestId("grid-filter-color-option-green"),
    ).toBeDefined();
    fireEvent.click(
      screen.getByTestId("grid-filter-color-option-red"),
    );
    await waitFor(() => {
      expect(screen.getByTestId("row-a")).toBeDefined();
      expect(screen.queryByTestId("row-b")).toBeNull();
    });
  });

  it("clears all column filters via the toolbar Clear filters button", async () => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "color",
        header: "Color",
        meta: { filterVariant: "multi-select" },
      },
    ];
    render(
      <DataTable
        columns={cols}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
        enableColumnFilters
        initiallyShowColumnFilters
        testIdPrefix="grid"
      />,
    );
    fireEvent.click(screen.getByTestId("grid-filter-color"));
    fireEvent.click(
      await screen.findByTestId("grid-filter-color-option-red"),
    );
    await waitFor(() => {
      expect(screen.queryByTestId("row-b")).toBeNull();
    });
    expect(screen.getByTestId("grid-active-filter-count").textContent).toBe(
      "1",
    );
    fireEvent.click(screen.getByTestId("grid-clear-filters"));
    await waitFor(() => {
      expect(screen.getByTestId("row-b")).toBeDefined();
    });
  });

  it("toggles between comfortable and compact density", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowTestId={(row) => `row-${row.id}`}
        enableDensityToggle
        testIdPrefix="grid"
      />,
    );
    const button = screen.getByTestId("grid-density-toggle");
    expect(button.textContent).toContain("Comfortable");
    fireEvent.click(button);
    expect(button.textContent).toContain("Compact");
  });

  it("renders a sticky header when stickyHeader is enabled", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        stickyHeader
      />,
    );
    const header = document.querySelector("thead");
    expect(header?.className).toContain("sticky");
  });

  it("shows an empty popover hint when a multi-select column has no faceted values", async () => {
    const cols: ColumnDef<Row>[] = [
      {
        id: "missing",
        accessorFn: () => "",
        header: "Missing",
        meta: { filterVariant: "multi-select" },
      },
    ];
    render(
      <DataTable
        columns={cols}
        data={data}
        enableColumnFilters
        initiallyShowColumnFilters
        testIdPrefix="grid"
      />,
    );
    fireEvent.click(screen.getByTestId("grid-filter-missing"));
    expect(await screen.findByText(/no values to filter/i)).toBeDefined();
  });
});

describe("multiSelectFilterFn", () => {
  const fakeRow = (
    value: unknown,
  ) => ({ getValue: () => value } as unknown as Parameters<
    typeof multiSelectFilterFn
  >[0]);

  it("includes everything when no filter values are selected", () => {
    expect(multiSelectFilterFn(fakeRow("red"), "color", undefined)).toBe(true);
    expect(multiSelectFilterFn(fakeRow("red"), "color", [])).toBe(true);
  });

  it("includes only rows whose stringified value matches", () => {
    expect(multiSelectFilterFn(fakeRow("red"), "color", ["red"])).toBe(true);
    expect(multiSelectFilterFn(fakeRow("blue"), "color", ["red"])).toBe(false);
  });

  it("rejects rows with a null/undefined value", () => {
    expect(multiSelectFilterFn(fakeRow(null), "color", ["red"])).toBe(false);
  });
});

describe("rangeFilterFn", () => {
  const fakeRow = (
    value: unknown,
  ) => ({ getValue: () => value } as unknown as Parameters<
    typeof rangeFilterFn
  >[0]);

  it("includes rows with no min/max constraints", () => {
    expect(rangeFilterFn(fakeRow(5), "v", undefined)).toBe(true);
    expect(rangeFilterFn(fakeRow(5), "v", [null, null])).toBe(true);
  });

  it("excludes rows below the min", () => {
    expect(rangeFilterFn(fakeRow(2), "v", [3, null])).toBe(false);
    expect(rangeFilterFn(fakeRow(3), "v", [3, null])).toBe(true);
  });

  it("excludes rows above the max", () => {
    expect(rangeFilterFn(fakeRow(10), "v", [null, 5])).toBe(false);
    expect(rangeFilterFn(fakeRow(5), "v", [null, 5])).toBe(true);
  });

  it("rejects non-numeric cell values", () => {
    expect(rangeFilterFn(fakeRow("abc"), "v", [0, 10])).toBe(false);
  });
});
