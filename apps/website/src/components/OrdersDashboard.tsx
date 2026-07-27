import * as React from "react";
import { Button, StatusBadge, Input, Select } from "@digico/design-system";
import { listOrders, bulkUpdateOrderStatus, type ListOrdersResult } from "../api.js";
import { CURRENCY_SYMBOL, formatCurrency } from "../format.js";
import { OrderReviewDrawer } from "./OrderReviewDrawer.js";
import { CreateOrderModal } from "./CreateOrderModal.js";
import { Search, Plus, Eye, RefreshCw } from "lucide-react";

export function OrdersDashboard() {
  const [ordersData, setOrdersData] = React.useState<ListOrdersResult | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [originFilter, setOriginFilter] = React.useState("");
  const [selectedOrderIds, setSelectedOrderIds] = React.useState<number[]>([]);
  const [bulkAction, setBulkAction] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // Modal / Drawer state
  const [reviewOrderId, setReviewOrderId] = React.useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  const fetchOrders = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await listOrders({
        status: activeTab,
        origin: originFilter || undefined,
        search: searchQuery || undefined,
      });
      setOrdersData(data);
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, originFilter, searchQuery]);

  React.useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && ordersData) {
      setSelectedOrderIds(ordersData.items.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelectOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleApplyBulkAction = async () => {
    if (!bulkAction || selectedOrderIds.length === 0) return;

    let targetStatus: any = null;
    if (bulkAction === "processing") targetStatus = "processing";
    if (bulkAction === "on_hold") targetStatus = "on_hold";
    if (bulkAction === "completed") targetStatus = "completed";
    if (bulkAction === "cancelled") targetStatus = "cancelled";

    if (targetStatus) {
      await bulkUpdateOrderStatus(selectedOrderIds, targetStatus, `Bulk action: ${bulkAction}`);
      setSelectedOrderIds([]);
      setBulkAction("");
      void fetchOrders();
    }
  };

  const counts = ordersData?.counts ?? {};

  return (
    <div className="space-y-6 p-6">
      {/* Top Title & Add Order Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Orders</h1>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" /> Add order
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Review, edit, confirm, or hold dealer orders coming in from WhatsApp AI and direct
            sales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchOrders()}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Status Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto text-xs font-semibold">
          {[
            { id: "all", label: "All", count: counts["all"] ?? 0 },
            { id: "pending_review", label: "Pending Review", count: counts["pending_review"] ?? 0 },
            { id: "on_hold", label: "On-Hold", count: counts["on_hold"] ?? 0 },
            { id: "confirmed", label: "Confirmed", count: counts["confirmed"] ?? 0 },
            { id: "processing", label: "Processing", count: counts["processing"] ?? 0 },
            { id: "cancelled", label: "Cancelled", count: counts["cancelled"] ?? 0 },
            { id: "completed", label: "Completed", count: counts["completed"] ?? 0 },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedOrderIds([]);
                }}
                className={`pb-3 px-1 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec2839] focus-visible:ring-offset-2 rounded-t-sm ${
                  isSelected
                    ? "border-[#ec2839] text-[#ec2839] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    isSelected ? "bg-[#ec2839]/10 text-[#ec2839]" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filters & Bulk Action Toolbar (matching reference screenshot) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Actions Dropdown */}
          <Select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="w-48 text-xs h-8"
          >
            <option value="">Bulk actions</option>
            <option value="processing">Change status to processing</option>
            <option value="on_hold">Change status to on-hold</option>
            <option value="completed">Change status to completed</option>
            <option value="cancelled">Change status to cancelled</option>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyBulkAction}
            disabled={!bulkAction || selectedOrderIds.length === 0}
            className="h-8 text-xs"
          >
            Apply
          </Button>

          {/* Quick Filters */}
          <Select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="w-44 text-xs h-8"
          >
            <option value="">All sales channels</option>
            <option value="whatsapp_ai">WhatsApp AI</option>
            <option value="manual_sales">Direct Sales Rep</option>
          </Select>
        </div>

        {/* Search bar */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8 w-full"
          />
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
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
                    onClick={() => setReviewOrderId(order.id)}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOrder(order.id)}
                        className="rounded border-gray-300 text-[#ec2839] focus:ring-[#ec2839]"
                      />
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      <span className="text-[#ec2839]">{order.orderNumber}</span>{" "}
                      {order.dealer.businessName}
                      <div className="text-[11px] font-normal text-gray-500">
                        {order.dealer.phone}
                      </div>
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
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
                        className="h-7 text-[11px] px-2.5"
                        onClick={() => setReviewOrderId(order.id)}
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

      {/* Review Drawer */}
      <OrderReviewDrawer
        orderId={reviewOrderId}
        open={Boolean(reviewOrderId)}
        onClose={() => setReviewOrderId(null)}
        onRefresh={fetchOrders}
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchOrders}
      />
    </div>
  );
}
