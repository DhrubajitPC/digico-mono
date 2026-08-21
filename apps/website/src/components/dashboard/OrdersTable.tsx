import { Button } from "@digico/design-system";
import type { OrderListItem, OrderListOutput } from "@digico/api";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  CURRENCY_SYMBOL,
  formatCurrency,
  getPageSelectionState,
  setPageSelection,
} from "@digico/utils";
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye } from "lucide-react";
import { trpc } from "../../trpc";
import { OrderStatusDropdown } from "./OrderStatusDropdown";

type ListOrdersResult = OrderListOutput;
type OrderRow = OrderListItem;

// Registered once at module scope: feature APIs do not exist until declared, and a
// fresh object each render would invalidate the data-dependent row models.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  // v9 does not ship sort functions implicitly. Without registering the ones
  // auto-detection can pick, columns log "sortFn '<name>' is not registered" and
  // silently do not sort.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

// Stable fallback: `data={items ?? []}` would rebuild every row model each render.
const EMPTY_ROWS: OrderRow[] = [];

const PAGE_SIZES = [25, 50, 100];

/** Per-column alignment, kept out of the column defs to avoid augmenting ColumnMeta. */
const ALIGN: Record<string, string> = {
  dealer: "text-left",
  createdAt: "text-left",
  status: "text-left",
  items: "text-left",
  totalAmount: "text-right",
  origin: "text-center",
};

interface OrdersTableProps {
  ordersData: ListOrdersResult | null;
  selectedOrderIds: number[];
  onSetSelectedIds: (ids: number[]) => void;
  onToggleSelectOrder: (id: number) => void;
  onReviewOrder: (id: number) => void;
}

export function OrdersTable({
  ordersData,
  selectedOrderIds,
  onSetSelectedIds,
  onToggleSelectOrder,
  onReviewOrder,
}: OrdersTableProps) {
  const utils = trpc.useUtils();
  const setOrderStatus = trpc.orders.setStatus.useMutation({
    onSuccess: async () => {
      await utils.orders.list.invalidate();
    },
  });
  const helper = createColumnHelper<typeof features, OrderRow>();

  // The checkbox and Review columns are deliberately NOT column defs: they are
  // affordances rather than data, and keeping them out lets these defs stay static
  // instead of being rebuilt whenever the selection changes.
  const columns = helper.columns([
    helper.accessor((row) => row.dealer.businessName, {
      id: "dealer",
      header: "Order & Dealer",
      cell: ({ row }) => (
        <>
          <span className="text-primary">{row.original.orderNumber}</span>{" "}
          {row.original.dealer.businessName}
          <div className="text-xs font-normal text-gray-500">{row.original.dealer.phone}</div>
        </>
      ),
    }),
    helper.accessor("createdAt", {
      header: "Date",
      cell: ({ getValue }) =>
        new Date(getValue()).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    }),
    helper.accessor("status", {
      header: "Status",
      cell: ({ getValue, row }) => (
        <OrderStatusDropdown
          status={getValue()}
          isSaving={setOrderStatus.isPending}
          onStatusChange={async (newStatus) => {
            try {
              await setOrderStatus.mutateAsync({
                id: Number(row.original.id),
                status: newStatus,
              });
            } catch (error) {
              console.error("STATUS UPDATE FAILED:", error);
            }
          }}
        />
      ),
    }),
    helper.display({
      id: "items",
      header: "Items / SKUs",
      cell: ({ row }) =>
        row.original.items.map((i) => `${i.quantity}x ${i.productName}`).join(", "),
    }),
    helper.accessor("totalAmount", {
      header: `Total (${CURRENCY_SYMBOL})`,
      cell: ({ getValue }) => formatCurrency(getValue()),
    }),
    helper.accessor("origin", {
      header: "Origin",
      cell: ({ getValue }) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
          {getValue() === "whatsapp_ai" ? "WhatsApp AI" : "Direct Sales"}
        </span>
      ),
    }),
  ]);

  const COLUMN_COUNT = columns.length + 2; // + checkbox + action
  const table = useTable(
    {
      features,
      columns,
      data: ordersData?.items ?? EMPTY_ROWS,
      initialState: {
        sorting: [{ id: "createdAt", desc: true }],
        pagination: { pageIndex: 0, pageSize: PAGE_SIZES[0] },
      },
    },
    // The selector is what subscribes this component to state changes. Without it
    // the row model is read through builder methods only, so toggling a sort
    // updates table state but never triggers a re-render.
    (state) => ({ sorting: state.sorting, pagination: state.pagination }),
  );

  const pageRows = table.getRowModel().rows;
  const pageIds = pageRows.map((row) => row.original.id);
  const pageSelection = getPageSelectionState(selectedOrderIds, pageIds);

  // v9 exposes state as `table.state` (no getState()); with no selector passed to
  // useTable, every registered slice is selected.
  const { pageIndex, pageSize } = table.state.pagination;
  const totalRows = table.getRowCount();
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all orders on this page"
                    checked={pageSelection === "all"}
                    ref={(el) => {
                      if (el) el.indeterminate = pageSelection === "some";
                    }}
                    onChange={(e) =>
                      onSetSelectedIds(
                        setPageSelection(selectedOrderIds, pageIds, e.target.checked),
                      )
                    }
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </th>

                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`p-3 ${ALIGN[header.column.id] ?? "text-left"} ${
                        sortable ? "cursor-pointer select-none hover:text-gray-900" : ""
                      }`}
                      onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                        {sortable ? (
                          sorted === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : sorted === "desc" ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 text-gray-400" />
                          )
                        ) : null}
                      </span>
                    </th>
                  );
                })}

                <th className="p-3 text-center">Action</th>
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-gray-200">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="p-8 text-center text-gray-500">
                  No orders found matching the current status and search filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const orderId = row.original.id;
                const isSelected = selectedOrderIds.includes(orderId);
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-gray-50/80 cursor-pointer ${
                      isSelected ? "bg-red-50/30" : ""
                    }`}
                    onClick={() => onReviewOrder(orderId)}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select order ${row.original.orderNumber}`}
                        checked={isSelected}
                        onChange={() => onToggleSelectOrder(orderId)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </td>

                    {row.getAllCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`p-3 whitespace-nowrap ${ALIGN[cell.column.id] ?? "text-left"} ${
                          cell.column.id === "dealer"
                            ? "font-semibold text-gray-900"
                            : "text-gray-600"
                        } ${cell.column.id === "totalAmount" ? "font-bold text-gray-900" : ""} ${
                          cell.column.id === "items" ? "max-w-xs truncate whitespace-normal" : ""
                        }`}
                        onClick={
                          cell.column.id === "status" ? (e) => e.stopPropagation() : undefined
                        }
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}

                    <td
                      className="p-3 text-center whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => onReviewOrder(orderId)}
                      >
                        <Eye className="w-3 h-3" /> Review
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalRows > 0 ? (
        <div className="flex items-center justify-between gap-4 border-t border-gray-200 px-3 py-2 text-sm text-gray-600">
          <span>
            {firstRow}–{lastRow} of {totalRows}
          </span>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wider">Rows</span>
              <select
                value={pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="rounded border border-gray-300 px-1.5 py-1 text-sm"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <span className="whitespace-nowrap">
              Page {pageIndex + 1} of {table.getPageCount()}
            </span>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
