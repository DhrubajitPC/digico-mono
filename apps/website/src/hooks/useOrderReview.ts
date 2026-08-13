import * as React from "react";
import {
  getOrder,
  updateOrder,
  updateOrderStatus,
  listProducts,
  type Order,
  type OrderItem,
  type Product,
} from "../api.js";
import { formatCurrency } from "@digico/utils";

/** Order + product loading, editable line items, message/notes, and the five mutation handlers. */
export function useOrderReview(
  orderId: number | null,
  options: { onRefresh: () => void; onClose: () => void },
) {
  const [order, setOrder] = React.useState<Order | null>(null);
  const [productsList, setProductsList] = React.useState<Product[]>([]);
  const [editableItems, setEditableItems] = React.useState<OrderItem[]>([]);
  const [proposedMsg, setProposedMsg] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedSku, setSelectedSku] = React.useState("");

  const loadData = React.useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getOrder(orderId);
      setOrder(data);
      setEditableItems(data.items.map((i) => ({ ...i })));
      setProposedMsg(
        data.proposedMessage ??
          `Dear ${data.dealer.businessName}, your order ${data.orderNumber} for total ${formatCurrency(data.totalAmount)} has been confirmed.`,
      );
      setNotes(data.notes ?? "");

      const prods = await listProducts();
      setProductsList(prods);
      if (prods.length > 0 && prods[0]) setSelectedSku(prods[0].sku);
    } catch (err) {
      console.error("Failed to load order details", err);
    }
  }, [orderId]);

  React.useEffect(() => {
    if (orderId) {
      void loadData();
    }
  }, [orderId, loadData]);

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
      await updateOrder(order.id, {
        notes,
        proposedMessage: proposedMsg,
        items: buildItemsPayload(),
      });
      await loadData();
      options.onRefresh();
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
      await updateOrder(order.id, {
        notes,
        proposedMessage: proposedMsg,
        items: buildItemsPayload(),
      });
      await updateOrderStatus(order.id, "confirmed", "Approved by Sales Admin", proposedMsg);
      options.onRefresh();
      options.onClose();
    } catch (err) {
      console.error("Failed to approve order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetStatus = async (status: Order["status"], reason?: string) => {
    if (!order) return;
    try {
      setIsSaving(true);
      await updateOrderStatus(order.id, status, reason);
      options.onRefresh();
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
        await updateOrder(order.id, {
          notes,
          proposedMessage: proposedMsg,
          items: buildItemsPayload(),
        });
      }
      await updateOrderStatus(order.id, "completed", "Marked as completed by Sales Admin");
      options.onRefresh();
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
