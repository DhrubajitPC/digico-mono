import * as React from "react";
import { Drawer, Button, StatusBadge, Input, Select } from "@digico/design-system";
import {
  getOrder,
  updateOrder,
  updateOrderStatus,
  listProducts,
  type Order,
  type OrderItem,
  type Product,
} from "../api.js";
import { formatCurrency } from "../format.js";
import {
  MessageSquare,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  Trash2,
  Bot,
  User,
  Sparkles,
  Save,
} from "lucide-react";

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

  // Product selection to add a new line item
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

  // Real-time calculation of total
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
      // Save any pending item edits first
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

      // Confirm status & trigger WhatsApp send
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
        {/* LEFT PANE (4 cols): WhatsApp Context & AI Extraction */}
        <div className="lg:col-span-5 space-y-4 border-b lg:border-b-0 lg:border-r border-gray-200 pr-0 lg:pr-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#ec2839]" /> WhatsApp Context
              </span>
              <StatusBadge status={order.status} />
            </div>

            {/* Dealer Contact Summary */}
            <div className="bg-white rounded-md p-3 border border-gray-200 text-xs space-y-1">
              <div className="font-semibold text-gray-900 text-sm">{order.dealer.businessName}</div>
              <div className="text-gray-500">Contact: {order.dealer.contactPerson ?? "N/A"}</div>
              <div className="text-gray-500">Phone: {order.dealer.phone}</div>
              {order.dealer.address && (
                <div className="text-gray-500">Address: {order.dealer.address}</div>
              )}
            </div>

            {/* AI Context Card */}
            <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3 text-xs text-emerald-950 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <Sparkles className="w-4 h-4 text-emerald-600" /> AI Intent Extraction
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Intent: <span className="font-semibold">ORDER_CREATION</span> (High Confidence 94%).
                AI matched <span className="font-semibold">{order.items.length} SKU(s)</span> from
                catalog aliases.
              </p>
            </div>

            {/* Simulated WhatsApp Transcript */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-gray-500">
                Recent Conversation Thread
              </span>
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3 max-h-[300px] overflow-y-auto text-xs">
                {/* Dealer message */}
                <div className="flex gap-2 items-start">
                  <div className="size-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-emerald-50 rounded-lg rounded-tl-none p-2.5 text-gray-800 border border-emerald-100 flex-1">
                    <div className="font-semibold text-emerald-800 text-[11px] mb-0.5">
                      Dealer Message
                    </div>
                    "Bhai HP i5 laptop ta koto? 3 ta lagbe ar Samsung 24 inch monitor 4 ta lagbe."
                  </div>
                </div>

                {/* AI response */}
                <div className="flex gap-2 items-start justify-end">
                  <div className="bg-gray-100 rounded-lg rounded-tr-none p-2.5 text-gray-800 border border-gray-200 flex-1 text-right">
                    <div className="font-semibold text-gray-700 text-[11px] mb-0.5">
                      Digico Sales AI
                    </div>
                    "Sir, HP 15s Core i5 price {formatCurrency(68500)} and Samsung 24 IPS Monitor
                    price {formatCurrency(12095)}. Draft order created for total{" "}
                    {formatCurrency(253880)}."
                  </div>
                  <div className="size-6 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Dealer confirmation */}
                <div className="flex gap-2 items-start">
                  <div className="size-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-emerald-50 rounded-lg rounded-tl-none p-2.5 text-gray-800 border border-emerald-100 flex-1">
                    "Ha, order confirmation ta pathay den."
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE (7 cols): Order Detail & Editable Line Items */}
        <div className="lg:col-span-7 space-y-6">
          {/* Editable Line Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase text-gray-800 tracking-wider">
                Order Line Items ({editableItems.length})
              </h3>
              <div className="text-xs text-gray-500 font-medium">
                Admins can override Qty & Price below
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
                  <tr>
                    <th className="p-2.5 text-left">SKU / Product Name</th>
                    <th className="p-2.5 text-center w-20">Qty</th>
                    <th className="p-2.5 text-right w-28">Unit Price</th>
                    <th className="p-2.5 text-right w-28">Line Total</th>
                    <th className="p-2.5 text-center w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {editableItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-2.5 font-medium text-gray-900">
                        {item.productName}
                        <div className="text-[11px] text-gray-400 font-mono">{item.sku}</div>
                      </td>
                      <td className="p-2.5 text-center">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                          className="h-7 text-center px-1 text-xs"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemPriceChange(idx, Number(e.target.value))}
                          className="h-7 text-right px-1 text-xs"
                        />
                      </td>
                      <td className="p-2.5 text-right font-semibold text-gray-900">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="p-3 text-right font-bold text-gray-700">
                      Total Order Amount:
                    </td>
                    <td className="p-3 text-right font-extrabold text-[#ec2839] text-base">
                      {formatCurrency(calculatedTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Quick Add SKU bar */}
            <div className="flex gap-2 items-center bg-gray-50 p-2.5 rounded-md border border-gray-200">
              <div className="flex-1">
                <Select value={selectedSku} onChange={(e) => setSelectedSku(e.target.value)}>
                  {productsList.map((p) => (
                    <option key={p.id} value={p.sku}>
                      {p.name} — {formatCurrency(p.unitPrice)} (Stock: {p.stockQuantity})
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleAddProduct}>
                <Plus className="w-3.5 h-3.5" /> Add Product
              </Button>
            </div>
          </div>

          {/* Internal Sales Notes */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
              Internal Admin Notes / Memo
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes for fulfillment team..."
            />
          </div>

          {/* LIVE EDITABLE WHATSAPP CONFIRMATION MESSAGE PREVIEW */}
          <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-emerald-600" /> WhatsApp Confirmation Message Preview
              </label>
              <span className="text-[11px] text-emerald-700 font-semibold">
                Will be sent to dealer upon approval
              </span>
            </div>
            <textarea
              rows={3}
              value={proposedMsg}
              onChange={(e) => setProposedMsg(e.target.value)}
              className="w-full rounded-md border border-emerald-300 bg-white p-3 text-xs font-mono text-gray-800 focus:border-emerald-500 focus:outline-none shadow-xs"
            />
          </div>

          {/* ACTION BUTTONS BAR */}
          <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveEdits}
                disabled={isSaving}
              >
                <Save className="w-4 h-4" /> Save Edits
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Cancel Button */}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleSetStatus("cancelled", "Rejected by Sales Admin")}
                disabled={isSaving}
              >
                <XCircle className="w-4 h-4" /> Reject / Cancel
              </Button>

              {/* On-Hold Button */}
              <Button
                type="button"
                variant="warning"
                size="sm"
                onClick={() => handleSetStatus("on_hold", "Placed on hold by Sales Admin")}
                disabled={isSaving}
              >
                <Clock className="w-4 h-4" /> Hold Order
              </Button>

              {/* Confirm & Send Button */}
              <Button
                type="button"
                variant="success"
                size="sm"
                onClick={handleApproveAndSend}
                disabled={isSaving || editableItems.length === 0}
              >
                <CheckCircle className="w-4 h-4" /> Approve & Confirm to WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
