import * as React from "react";
import { Button } from "@digico/design-system";
import { listOrders, bulkUpdateOrderStatus, type ListOrdersResult, type Order } from "../api.js";
import { OrderReviewDrawer } from "./OrderReviewDrawer.js";
import { CreateOrderModal } from "./CreateOrderModal.js";
import { DashboardTabs } from "./dashboard/DashboardTabs.js";
import { DashboardToolbar } from "./dashboard/DashboardToolbar.js";
import { OrdersTable } from "./dashboard/OrdersTable.js";
import { Plus, RefreshCw } from "lucide-react";

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

    let targetStatus: Order["status"] | null = null;
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Orders</h1>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" /> Add order
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
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

      {/* Tabs */}
      <DashboardTabs
        activeTab={activeTab}
        onTabChange={(tabId) => {
          setActiveTab(tabId);
          setSelectedOrderIds([]);
        }}
        counts={counts}
      />

      {/* Toolbar */}
      <DashboardToolbar
        bulkAction={bulkAction}
        onBulkActionChange={setBulkAction}
        selectedOrderIdsCount={selectedOrderIds.length}
        onApplyBulkAction={handleApplyBulkAction}
        originFilter={originFilter}
        onOriginFilterChange={setOriginFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {/* Table */}
      <OrdersTable
        ordersData={ordersData}
        selectedOrderIds={selectedOrderIds}
        onSelectAll={handleSelectAll}
        onToggleSelectOrder={handleToggleSelectOrder}
        onReviewOrder={setReviewOrderId}
      />

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
