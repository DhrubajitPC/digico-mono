import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { listOrders, bulkUpdateOrderStatus, type ListOrdersResult, type Order } from "../api.js";

/** Fetch state, tab/search/origin filters, row selection, and bulk actions for the orders dashboard. */
export function useOrders() {
  const [ordersData, setOrdersData] = useState<ListOrdersResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Modal / Drawer state
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchOrders = useCallback(async () => {
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

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
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
