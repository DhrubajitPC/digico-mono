import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "../trpc.js";
import type { ListOrdersInput } from "@digico/api";
import type { OrderOriginType, OrderStatusType } from "@digico/contracts";

const BULK_ACTION_STATUS: Record<string, OrderStatusType | null> = {
  processing: "processing",
  on_hold: "on_hold",
  completed: "completed",
  cancelled: "cancelled",
};

/** Fetch state, tab/search/origin filters, row selection, and bulk actions for the orders dashboard. */
export function useOrders() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<NonNullable<ListOrdersInput["status"]>>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<OrderOriginType | "">("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const ordersQuery = trpc.orders.list.useQuery({
    status: activeTab,
    origin: originFilter || undefined,
    search: searchQuery || undefined,
  });

  // const bulkStatusMutation = trpc.orders.bulkSetStatus.useMutation({
  //   onSuccess: () => void utils.orders.list.invalidate(),
  // });

  const bulkStatusMutation = trpc.orders.bulkSetStatus.useMutation({
    onSuccess: () => {
      void utils.orders.list.invalidate();
      toast.success("Order statuses updated successfully.");
    },
  });

  const fetchOrders = () => {
    void utils.orders.list.invalidate();
  };

  const handleToggleSelectOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleApplyBulkAction = async () => {
    if (!bulkAction || selectedOrderIds.length === 0) return;
    const targetStatus = BULK_ACTION_STATUS[bulkAction];
    if (!targetStatus) return;
    // await bulkStatusMutation.mutateAsync({
    //   orderIds: selectedOrderIds,
    //   status: targetStatus,
    //   reason: `Bulk action: ${bulkAction}`,
    // });
    // setSelectedOrderIds([]);
    // setBulkAction("");
    try {
      await bulkStatusMutation.mutateAsync({
        orderIds: selectedOrderIds,
        status: targetStatus,
        reason: `Bulk action: ${bulkAction}`,
      });

      setSelectedOrderIds([]);
      setBulkAction("");

      toast.success("Order statuses updated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order status.");
    }
  };

  return {
    ordersData: ordersQuery.data ?? null,
    activeTab,
    searchQuery,
    originFilter,
    selectedOrderIds,
    bulkAction,
    isLoading: ordersQuery.isFetching,
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
    handleToggleSelectOrder,
    handleApplyBulkAction,
    counts: ordersQuery.data?.counts ?? {},
  };
}
