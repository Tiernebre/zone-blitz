import { type ReactNode, useMemo, useState } from "react";
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  type RowData,
  type SortingState,
  type Table as ReactTable,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter as FilterIcon,
  Rows3,
  Rows4,
  Search as SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: "text" | "select" | "multi-select" | "range";
    filterOptions?: { value: string; label: string }[];
    filterFormatLabel?: (value: string) => string;
    filterPlaceholder?: string;
    filterTestId?: string;
    filterLabel?: string;
  }
}

type Density = "comfortable" | "compact";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowTestId?: (row: TData) => string;
  /** Custom toolbar; rendered to the right of built-in toolbar controls. */
  toolbar?: (table: ReactTable<TData>) => ReactNode;
  /** Show built-in global search input. */
  enableGlobalFilter?: boolean;
  /** Show built-in "Filters" toggle that reveals a per-column filter row. */
  enableColumnFilters?: boolean;
  /** Show built-in density toggle. */
  enableDensityToggle?: boolean;
  /** Make the header row sticky. Caller should constrain table height. */
  stickyHeader?: boolean;
  /** Initial table density. */
  initialDensity?: Density;
  /** Whether the column-filter row is open initially. */
  initiallyShowColumnFilters?: boolean;
  /** Placeholder for the global search input. */
  searchPlaceholder?: string;
  /** Prefix for auto-generated test ids on toolbar/filter widgets. */
  testIdPrefix?: string;
  /** Render-prop body for the empty state row. */
  emptyMessage?: ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  getRowTestId,
  toolbar,
  enableGlobalFilter = false,
  enableColumnFilters = false,
  enableDensityToggle = false,
  stickyHeader = false,
  initialDensity = "comfortable",
  initiallyShowColumnFilters = false,
  searchPlaceholder = "Search…",
  testIdPrefix,
  emptyMessage = "No results.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [density, setDensity] = useState<Density>(initialDensity);
  const [showColumnFilters, setShowColumnFilters] = useState(
    initiallyShowColumnFilters,
  );

  const decoratedColumns = useMemo(
    () => decorateColumns(columns),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: decoratedColumns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
  });

  const rows = table.getRowModel().rows;
  const totalRows = data.length;
  const filteredRows = rows.length;
  const activeFilters = columnFilters.length;

  const builtInToolbar = enableGlobalFilter || enableColumnFilters ||
    enableDensityToggle;

  const cellPaddingClass = density === "compact" ? "py-1.5" : "py-3";
  const cellTextClass = density === "compact" ? "text-xs" : "text-sm";

  return (
    <div className="flex flex-col gap-3" data-testid={testIdPrefix}>
      {(builtInToolbar || toolbar) && (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid={testIdPrefix ? `${testIdPrefix}-toolbar` : undefined}
        >
          {enableGlobalFilter && (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-56 pl-8 text-sm"
                data-testid={testIdPrefix
                  ? `${testIdPrefix}-search`
                  : undefined}
                aria-label="Search"
              />
            </div>
          )}
          {enableColumnFilters && (
            <Button
              variant={showColumnFilters ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setShowColumnFilters((v) => !v)}
              data-testid={testIdPrefix
                ? `${testIdPrefix}-toggle-filters`
                : undefined}
              aria-pressed={showColumnFilters}
            >
              <FilterIcon className="size-3.5" />
              Filters
              {activeFilters > 0 && (
                <span
                  className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
                  data-testid={testIdPrefix
                    ? `${testIdPrefix}-active-filter-count`
                    : undefined}
                >
                  {activeFilters}
                </span>
              )}
            </Button>
          )}
          {enableColumnFilters && activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setColumnFilters([])}
              data-testid={testIdPrefix
                ? `${testIdPrefix}-clear-filters`
                : undefined}
            >
              Clear filters
            </Button>
          )}
          {enableDensityToggle && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() =>
                setDensity((d) =>
                  d === "comfortable" ? "compact" : "comfortable"
                )}
              data-testid={testIdPrefix
                ? `${testIdPrefix}-density-toggle`
                : undefined}
              aria-label={`Switch to ${
                density === "comfortable" ? "compact" : "comfortable"
              } density`}
            >
              {density === "comfortable"
                ? <Rows3 className="size-3.5" />
                : <Rows4 className="size-3.5" />}
              {density === "comfortable" ? "Comfortable" : "Compact"}
            </Button>
          )}
          {toolbar?.(table)}
          {enableGlobalFilter && globalFilter && (
            <span
              className="ml-auto text-xs text-muted-foreground tabular-nums"
              data-testid={testIdPrefix
                ? `${testIdPrefix}-result-count`
                : undefined}
            >
              {filteredRows} of {totalRows}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "rounded-md border",
          stickyHeader ? "overflow-auto" : "overflow-hidden",
        )}
      >
        <Table>
          <TableHeader
            className={cn(
              stickyHeader && "sticky top-0 z-10 bg-background shadow-sm",
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
            {enableColumnFilters && showColumnFilters && (
              <TableRow
                data-testid={testIdPrefix
                  ? `${testIdPrefix}-filter-row`
                  : undefined}
              >
                {table.getHeaderGroups()[0]?.headers.map((header) => {
                  const variant = header.column.columnDef.meta?.filterVariant;
                  const canFilter = header.column.getCanFilter() &&
                    variant != null;
                  return (
                    <TableHead
                      key={`${header.id}-filter`}
                      className="py-1.5 align-top"
                    >
                      {canFilter
                        ? (
                          <DataTableColumnFilter
                            column={header.column}
                            testIdPrefix={testIdPrefix}
                          />
                        )
                        : null}
                    </TableHead>
                  );
                })}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {rows.length
              ? rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  data-testid={getRowTestId?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(cellPaddingClass, cellTextClass)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
              : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SortableHeader<TData, TValue>({
  column,
  children,
}: {
  column: Column<TData, TValue>;
  children: ReactNode;
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc"
    ? ArrowUp
    : sorted === "desc"
    ? ArrowDown
    : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2.5 h-7 px-2"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {children}
      <Icon className="ml-1 size-3.5 opacity-70" />
    </Button>
  );
}

export const multiSelectFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: unknown,
) => {
  const values = filterValue as string[] | undefined;
  if (!values || values.length === 0) return true;
  const cellValue = row.getValue(columnId);
  if (cellValue == null) return false;
  return values.includes(String(cellValue));
};

export const rangeFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: unknown,
) => {
  const [min, max] = (filterValue as [number | null, number | null]) ??
    [null, null];
  const cellValue = row.getValue(columnId);
  const numeric = typeof cellValue === "number" ? cellValue : Number(cellValue);
  if (Number.isNaN(numeric)) return false;
  if (min != null && numeric < min) return false;
  if (max != null && numeric > max) return false;
  return true;
};

function decorateColumns<TData, TValue>(
  columns: ColumnDef<TData, TValue>[],
): ColumnDef<TData, TValue>[] {
  return columns.map((col) => {
    const variant = col.meta?.filterVariant;
    if (col.filterFn != null || variant == null) return col;
    if (variant === "select" || variant === "multi-select") {
      return { ...col, filterFn: multiSelectFilterFn };
    }
    if (variant === "range") {
      return { ...col, filterFn: rangeFilterFn };
    }
    return col;
  });
}

function DataTableColumnFilter<TData, TValue>(
  { column, testIdPrefix }: {
    column: Column<TData, TValue>;
    testIdPrefix: string | undefined;
  },
) {
  const meta = column.columnDef.meta;
  const variant = meta?.filterVariant;
  const filterTestId = meta?.filterTestId ??
    (testIdPrefix ? `${testIdPrefix}-filter-${column.id}` : undefined);

  if (variant === "text") {
    return (
      <Input
        value={(column.getFilterValue() as string | undefined) ?? ""}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        placeholder={meta?.filterPlaceholder ?? "Filter…"}
        className="h-7 text-xs"
        data-testid={filterTestId}
        aria-label={`Filter ${column.id}`}
      />
    );
  }

  if (variant === "range") {
    return <RangeFilter column={column} testId={filterTestId} />;
  }

  if (variant === "select" || variant === "multi-select") {
    return (
      <MultiSelectFilter
        column={column}
        testId={filterTestId}
        single={variant === "select"}
      />
    );
  }

  return null;
}

function RangeFilter<TData, TValue>(
  { column, testId }: {
    column: Column<TData, TValue>;
    testId: string | undefined;
  },
) {
  const [min, max] = (column.getFilterValue() as
    | [number | null, number | null]
    | undefined) ?? [null, null];
  const update = (next: [number | null, number | null]) => {
    if (next[0] == null && next[1] == null) {
      column.setFilterValue(undefined);
    } else {
      column.setFilterValue(next);
    }
  };
  return (
    <div className="flex items-center gap-1" data-testid={testId}>
      <Input
        type="number"
        value={min ?? ""}
        onChange={(e) =>
          update([e.target.value === "" ? null : Number(e.target.value), max])}
        placeholder="Min"
        className="h-7 w-16 text-xs"
        data-testid={testId ? `${testId}-min` : undefined}
        aria-label={`${column.id} minimum`}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="number"
        value={max ?? ""}
        onChange={(e) =>
          update([min, e.target.value === "" ? null : Number(e.target.value)])}
        placeholder="Max"
        className="h-7 w-16 text-xs"
        data-testid={testId ? `${testId}-max` : undefined}
        aria-label={`${column.id} maximum`}
      />
    </div>
  );
}

function MultiSelectFilter<TData, TValue>(
  { column, testId, single }: {
    column: Column<TData, TValue>;
    testId: string | undefined;
    single: boolean;
  },
) {
  const meta = column.columnDef.meta;
  const formatLabel = meta?.filterFormatLabel ?? ((v: string) => v);
  const options = useMemo(() => {
    if (meta?.filterOptions) return meta.filterOptions;
    return Array.from(column.getFacetedUniqueValues().keys())
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .sort((a, b) => formatLabel(a).localeCompare(formatLabel(b)))
      .map((value) => ({ value, label: formatLabel(value) }));
    // re-evaluate when facets change
  }, [column.getFacetedUniqueValues(), meta?.filterOptions, formatLabel]);

  const selected = (column.getFilterValue() as string[] | undefined) ?? [];
  const summary = selected.length === 0
    ? "All"
    : selected.length === 1
    ? formatLabel(selected[0])
    : `${selected.length} selected`;

  const toggle = (value: string) => {
    if (single) {
      column.setFilterValue(selected[0] === value ? undefined : [value]);
      return;
    }
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    column.setFilterValue(next.length === 0 ? undefined : next);
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full justify-between gap-1 px-2 text-xs font-normal"
            data-testid={testId}
            aria-label={`Filter ${column.id}`}
          >
            <span
              className={cn(
                "truncate",
                selected.length === 0 && "text-muted-foreground",
              )}
            >
              {summary}
            </span>
            <FilterIcon className="size-3 opacity-60" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-56 max-h-72 overflow-auto p-1.5"
      >
        {options.length === 0
          ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              No values to filter.
            </p>
          )
          : (
            <ul
              className="flex flex-col gap-0.5"
              data-testid={testId ? `${testId}-options` : undefined}
            >
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggle(opt.value)}
                      data-testid={testId
                        ? `${testId}-option-${opt.value}`
                        : undefined}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                      <Checkbox
                        checked={isSelected}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="pointer-events-none"
                      />
                      <span className="flex-1 truncate">{opt.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 w-full text-xs"
            onClick={() => column.setFilterValue(undefined)}
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
