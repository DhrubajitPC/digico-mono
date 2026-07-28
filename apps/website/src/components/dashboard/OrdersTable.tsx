import * as React from "react";
import { Button, StatusBadge } from "@digico/design-system";
import type { ListOrdersResult } from "../../api.js";
import { CURRENCY_SYMBOL, formatCurrency } from "../../format.js";
import { Eye } from "lucide-react";

interface OrdersTableProps {
  ordersData: ListOrdersResult | null;
  selectedOrderIds: number[];
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSelectOrder: (id: number) => void;
  onReviewOrder: (id: number) => void;
}

export function OrdersTable({
  ordersData,
  selectedOrderIds,
  onSelectAll,
  onToggleSelectOrder,
  onReviewOrder,
}: OrdersTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-xs overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
          <tr>
            <th className="p-3 w-10 text-center">
              <input
                type="checkbox"
                onChange={onSelectAll}
                checked={
                  Boolean(ordersData?.items.length) &&
                  selectedOrderIds.length === ordersData?.items.length
                }
                className="rounded border-gray-300 text-[#ec2839] focus:ring-[#ec2839]"
              />
            </th>
            <th className="p-3 text-left">Order & Dealer</th>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Items / SKUs</th>
            <th className="p-3 text-right">Total ({CURRENCY_SYMBOL})</th>
            <th className="p-3 text-center">Origin</th>
            <th className="p-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {!ordersData || ordersData.items.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-8 text-center text-gray-500">
                No orders found matching the current status and search filters.
              </td>
            </tr>
          ) : (
            ordersData.items.map((order) => {
              const isSelected = selectedOrderIds.includes(order.id);
              return (
                <tr
                  key={order.id}
                  className={`transition-colors hover:bg-gray-50/80 cursor-pointer ${
                    isSelected ? "bg-red-50/30" : ""
                  }`}
                  onClick={() => onReviewOrder(order.id)}
                >
                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectOrder(order.id)}
                      className="rounded border-gray-300 text-[#ec2839] focus:ring-[#ec2839]"
                    />
                  </td>
                  <td className="p-3 font-semibold text-gray-900">
                    <span className="text-[#ec2839]">{order.orderNumber}</span>{" "}
                    {order.dealer.businessName}
                    <div className="text-xs font-normal text-gray-500">{order.dealer.phone}</div>
                  </td>
                  <td className="p-3 text-gray-600 whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="p-3 text-gray-600 max-w-xs truncate">
                    {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                  </td>
                  <td className="p-3 text-right font-bold text-gray-900 whitespace-nowrap">
                    {formatCurrency(order.totalAmount)}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      {order.origin === "whatsapp_ai" ? "WhatsApp AI" : "Direct Sales"}
                    </span>
                  </td>
                  <td
                    className="p-3 text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => onReviewOrder(order.id)}
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
  );
}
