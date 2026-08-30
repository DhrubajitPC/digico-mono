import { useEffect, useState } from "react";
import { trpc } from "../trpc.js";
import type { OrderDetail, SetOrderStatusInput } from "@digico/api";
import { formatCurrency } from "@digico/utils";

/** Order + product loading, editable line items, message/notes, and the five mutation handlers. */
export function useOrderReview(
  orderId: number | null,
  options: { onRefresh: () => void; onClose: () => void },
) {
  const utils = trpc.useUtils();
  const [editableItems, setEditableItems] = useState<OrderDetail["items"]>([]);
  const [proposedMsg, setProposedMsg] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");

  const orderQuery = trpc.orders.get.useQuery({ id: orderId ?? 0 }, { enabled: orderId !== null });
  const productsQuery = trpc.products.list.useQuery();
  const order = orderQuery.data ?? null;
  const productsList = productsQuery.data ?? [];

  // Sync local editable state whenever the order (re)loads — same behavior as the old loadData().
  useEffect(() => {
    if (!order) return;
    setEditableItems(order.items.map((i) => ({ ...i })));
    setProposedMsg(
      order.proposedMessage ??
        `Dear ${order.dealer.businessName}, your order ${order.orderNumber} for total ${formatCurrency(order.totalAmount)} has been confirmed.`,
    );
    setNotes(order.notes ?? "");
  }, [order]);

  useEffect(() => {
    const first = productsList[0];
    if (first) setSelectedSku(first.sku);
  }, [productsList]);

  const updateMutation = trpc.orders.update.useMutation({
    onSuccess: () => {
      void utils.orders.get.invalidate();
      void utils.products.list.invalidate();
      options.onRefresh();
    },
  });
  const statusMutation = trpc.orders.setStatus.useMutation({
    onSuccess: () => {
      void utils.orders.get.invalidate();
      options.onRefresh();
    },
  });

  const calculatedTotal = editableItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const handleItemQtyChange = (idx: number, qty: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = {
          ...next[idx],
          quantity: Math.max(1, qty),
          lineTotal: Math.max(1, qty) * next[idx].unitPrice,
        };
      }
      return next;
    });
  };

  const handleItemPriceChange = (idx: number, price: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = {
          ...next[idx],
          unitPrice: Math.max(0, price),
          lineTotal: next[idx].quantity * Math.max(0, price),
        };
      }
      return next;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddProduct = () => {
    if (!order) return;
    const prod = productsList.find((p) => p.sku === selectedSku);
    if (!prod) return;

    setEditableItems((prev) => [
      ...prev,
      {
        id: Math.floor(Math.random() * 10000),
        orderId: order.id,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        quantity: 1,
        unitPrice: prod.unitPrice,
        lineTotal: prod.unitPrice,
      },
    ]);
  };

  const buildItemsPayload = () =>
    editableItems.map((i) => ({
      productId: i.productId ?? undefined,
      sku: i.sku,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));

  const handleSaveEdits = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      // await updateMutation.mutateAsync({
      //   id: order.id,
      //   notes,
      //   proposedMessage: proposedMsg,
      //   items: buildItemsPayload(),
      // });
      const itemsChanged = JSON.stringify(editableItems) !== JSON.stringify(order.items);

      await updateMutation.mutateAsync({
        id: order.id,
        notes,
        proposedMessage: proposedMsg,
        ...(itemsChanged ? { items: buildItemsPayload() } : {}),
      });
    } catch (err) {
      console.error("Failed to update order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndSend = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      await updateMutation.mutateAsync({
        id: order.id,
        notes,
        proposedMessage: proposedMsg,
        items: buildItemsPayload(),
      });
      await statusMutation.mutateAsync({
        id: order.id,
        status: "confirmed",
        reason: "Approved by Sales Admin",
        proposedMessage: proposedMsg,
      });
      options.onClose();
    } catch (err) {
      console.error("Failed to approve order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetStatus = async (status: SetOrderStatusInput["status"], reason?: string) => {
    if (!order) return;
    try {
      setIsSaving(true);
      await statusMutation.mutateAsync({ id: order.id, status, reason });
      options.onClose();
    } catch (err) {
      console.error("Failed to change order status", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      const isModified =
        JSON.stringify(editableItems) !== JSON.stringify(order.items) ||
        proposedMsg !== (order.proposedMessage ?? "");
      if (isModified) {
        await updateMutation.mutateAsync({
          id: order.id,
          notes,
          proposedMessage: proposedMsg,
          items: buildItemsPayload(),
        });
      }
      await statusMutation.mutateAsync({
        id: order.id,
        status: "completed",
        reason: "Marked as completed by Sales Admin",
      });
      options.onClose();
    } catch (err) {
      console.error("Failed to complete order", err);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    order,
    productsList,
    editableItems,
    proposedMsg,
    notes,
    isSaving,
    selectedSku,
    calculatedTotal,
    setProposedMsg,
    setNotes,
    setSelectedSku,
    handleItemQtyChange,
    handleItemPriceChange,
    handleRemoveItem,
    handleAddProduct,
    handleSaveEdits,
    handleApproveAndSend,
    handleSetStatus,
    handleMarkCompleted,
  };
}
