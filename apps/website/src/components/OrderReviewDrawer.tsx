import { Drawer, Input } from "@digico/design-system";
import { useOrderReview } from "../hooks/useOrderReview.js";
import { OrderContextPane } from "./order-review/OrderContextPane.js";
import { LineItemsEditor } from "./shared/LineItemsEditor.js";
import { WhatsAppPreviewBox } from "./order-review/WhatsAppPreviewBox.js";
import { OrderDrawerActionBar } from "./order-review/OrderDrawerActionBar.js";

interface OrderReviewDrawerProps {
  orderId: number | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

/** Presentational review drawer; data + mutations live in useOrderReview. */
export function OrderReviewDrawer({ orderId, open, onClose, onRefresh }: OrderReviewDrawerProps) {
  const {
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
  } = useOrderReview(orderId, { onRefresh, onClose });

  if (!order) return null;

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
          <LineItemsEditor
            mode="editable"
            orderStatus={order.status}
            items={editableItems}
            total={calculatedTotal}
            productsList={productsList}
            selectedSku={selectedSku}
            onSelectedSkuChange={setSelectedSku}
            onAddItem={handleAddProduct}
            onRemoveItem={handleRemoveItem}
            onItemQtyChange={handleItemQtyChange}
            onItemPriceChange={handleItemPriceChange}
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
