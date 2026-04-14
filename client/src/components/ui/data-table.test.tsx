import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { afterEach, describe, expect, it } from "vitest";
import { DataTable, SortableHeader } from "./data-table.tsx";

type Row = { id: string; name: string; value: number };

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const data: Row[] = [
  { id: "a", name: "Alpha", value: 2 },
  { id: "b", name: "Beta", value: 1 },
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

  it("renders a toolbar and filters rows via the global filter", () => {
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
});
