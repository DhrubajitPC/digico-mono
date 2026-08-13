import * as React from "react";
import { listOrders, bulkUpdateOrderStatus, type ListOrdersResult, type Order } from "../api.js";

/** Fetch state, tab/search/origin filters, row selection, and bulk actions for the orders dashboard. */
export function useOrders() {
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

  return {
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
    counts: ordersData?.counts ?? {},
  };
}
