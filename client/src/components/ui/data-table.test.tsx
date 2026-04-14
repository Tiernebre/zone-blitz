import { cleanup, render, screen, within } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { afterEach, describe, expect, it } from "vitest";
import { DataTable } from "./data-table.tsx";

type Row = { id: string; name: string; value: number };

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const data: Row[] = [
  { id: "a", name: "Alpha", value: 1 },
  { id: "b", name: "Beta", value: 2 },
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
});
