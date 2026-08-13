import * as React from "react";
import { Drawer, Input } from "@digico/design-system";
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
import { OrderContextPane } from "./order-review/OrderContextPane.js";
import { EditableLineItemsTable } from "./order-review/EditableLineItemsTable.js";
import { WhatsAppPreviewBox } from "./order-review/WhatsAppPreviewBox.js";
import { OrderDrawerActionBar } from "./order-review/OrderDrawerActionBar.js";

interface OrderReviewDrawerProps {
  orderId: number | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function OrderReviewDrawer({ orderId, open, onClose, onRefresh }: OrderReviewDrawerProps) {
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
    if (open && orderId) {
      void loadData();
    }
  }, [open, orderId, loadData]);

  if (!order) return null;

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

  const handleSaveEdits = async () => {
    try {
      setIsSaving(true);
      await updateOrder(order.id, {
        notes,
        proposedMessage: proposedMsg,
        items: editableItems.map((i) => ({
          productId: i.productId ?? undefined,
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });
      await loadData();
      onRefresh();
    } catch (err) {
      console.error("Failed to update order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndSend = async () => {
    try {
      setIsSaving(true);
      await updateOrder(order.id, {
        notes,
        proposedMessage: proposedMsg,
        items: editableItems.map((i) => ({
          productId: i.productId ?? undefined,
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });
      await updateOrderStatus(order.id, "confirmed", "Approved by Sales Admin", proposedMsg);
      onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to approve order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetStatus = async (status: Order["status"], reason?: string) => {
    try {
      setIsSaving(true);
      await updateOrderStatus(order.id, status, reason);
      onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to change order status", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    try {
      setIsSaving(true);
      const isModified =
        JSON.stringify(editableItems) !== JSON.stringify(order.items) ||
        proposedMsg !== (order.proposedMessage ?? "");
      if (isModified) {
        await updateOrder(order.id, {
          notes,
          proposedMessage: proposedMsg,
          items: editableItems.map((i) => ({
            productId: i.productId ?? undefined,
            sku: i.sku,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        });
      }
      await updateOrderStatus(order.id, "completed", "Marked as completed by Sales Admin");
      onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to complete order", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`${order.orderNumber} — ${order.dealer.businessName}`}
      subtitle={`Created on ${new Date(order.createdAt).toLocaleString()} via ${
        order.origin === "whatsapp_ai" ? "WhatsApp AI" : "Direct Sales"
      }`}
      width="4xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PANE (5 cols): Order Context & Dealer Info */}
        <OrderContextPane order={order} />

        {/* RIGHT PANE (7 cols): Editable Line Items, Notes, & Message Preview */}
        <div className="lg:col-span-7 space-y-6">
          <EditableLineItemsTable
            items={editableItems}
            calculatedTotal={calculatedTotal}
            productsList={productsList}
            selectedSku={selectedSku}
            onSelectedSkuChange={setSelectedSku}
            onItemQtyChange={handleItemQtyChange}
            onItemPriceChange={handleItemPriceChange}
            onRemoveItem={handleRemoveItem}
            onAddProduct={handleAddProduct}
          />

          {/* Internal Memo Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Internal Admin Notes / Memo
            </label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Discount approved by manager..."
              className="text-sm shadow-xs"
            />
          </div>

          {/* Message Preview Box */}
          <WhatsAppPreviewBox
            origin={order.origin}
            proposedMsg={proposedMsg}
            onProposedMsgChange={setProposedMsg}
          />

          {/* Action Buttons Bar */}
          <OrderDrawerActionBar
            order={order}
            editableItemsLength={editableItems.length}
            isSaving={isSaving}
            onSaveEdits={handleSaveEdits}
            onSetStatus={handleSetStatus}
            onMarkCompleted={handleMarkCompleted}
            onApproveAndSend={handleApproveAndSend}
          />
        </div>
      </div>
    </Drawer>
  );
}
