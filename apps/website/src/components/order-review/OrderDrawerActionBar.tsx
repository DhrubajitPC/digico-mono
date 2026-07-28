import * as React from "react";
import { Button } from "@digico/design-system";
import type { Order } from "../../api.js";
import { Save, XCircle, Clock, CheckCircle } from "lucide-react";

interface OrderDrawerActionBarProps {
  order: Order;
  editableItemsLength: number;
  isSaving: boolean;
  onSaveEdits: () => void;
  onSetStatus: (status: Order["status"], reason?: string) => void;
  onMarkCompleted: () => void;
  onApproveAndSend: () => void;
}

export function OrderDrawerActionBar({
  order,
  editableItemsLength,
  isSaving,
  onSaveEdits,
  onSetStatus,
  onMarkCompleted,
  onApproveAndSend,
}: OrderDrawerActionBarProps) {
  return (
    <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSaveEdits} disabled={isSaving}>
          <Save className="w-4 h-4" /> Save Edits
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Cancel Button */}
        {order.status !== "cancelled" && order.status !== "completed" && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onSetStatus("cancelled", "Rejected by Sales Admin")}
            disabled={isSaving}
          >
            <XCircle className="w-4 h-4" /> Reject / Cancel
          </Button>
        )}

        {/* On-Hold Button */}
        {order.status !== "on_hold" &&
          order.status !== "completed" &&
          order.status !== "cancelled" && (
            <Button
              type="button"
              variant="warning"
              size="sm"
              onClick={() => onSetStatus("on_hold", "Placed on hold by Sales Admin")}
              disabled={isSaving}
            >
              <Clock className="w-4 h-4" /> Hold Order
            </Button>
          )}

        {/* Move to Processing Button */}
        {order.status === "confirmed" && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSetStatus("processing", "Order moved to warehouse processing")}
            disabled={isSaving}
          >
            <Clock className="w-4 h-4" /> Move to Processing
          </Button>
        )}

        {/* Mark as Completed Button */}
        {order.status !== "completed" && order.status !== "cancelled" && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onMarkCompleted}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="w-4 h-4" /> Mark as Completed
          </Button>
        )}

        {/* Confirm & Send Button for Pending / Hold */}
        {(order.status === "pending_review" || order.status === "on_hold") && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onApproveAndSend}
            disabled={isSaving || editableItemsLength === 0}
          >
            <CheckCircle className="w-4 h-4" />{" "}
            {order.origin === "whatsapp_ai"
              ? "Approve & Confirm to WhatsApp"
              : "Approve & Confirm Order"}
          </Button>
        )}
      </div>
    </div>
  );
}
