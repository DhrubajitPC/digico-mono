import { Button } from "@digico/design-system";
import { useOrders } from "../hooks/useOrders.js";
import { OrderReviewDrawer } from "./OrderReviewDrawer.js";
import { CreateOrderModal } from "./CreateOrderModal.js";
import { DashboardTabs } from "./dashboard/DashboardTabs.js";
import { DashboardToolbar } from "./dashboard/DashboardToolbar.js";
import { OrdersTable } from "./dashboard/OrdersTable.js";
import { Plus, RefreshCw } from "lucide-react";

/** Presentational orders dashboard; data + state live in useOrders. */
export function OrdersDashboard() {
  const {
    ordersData,
    activeTab,
    searchQuery,
    originFilter,
    selectedOrderIds,
    bulkAction,
    isLoading,
    reviewOrderId,
    showCreateModal,
    setActiveTab,
    setSearchQuery,
    setOriginFilter,
    setBulkAction,
    setSelectedOrderIds,
    setReviewOrderId,
    setShowCreateModal,
    fetchOrders,
    handleSelectAll,
    handleToggleSelectOrder,
    handleApplyBulkAction,
    counts,
  } = useOrders();

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
          <Button variant="outline" size="sm" onClick={() => fetchOrders()}>
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
