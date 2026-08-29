import { Button } from "@digico/design-system";
import type { OrderDetail, SetOrderStatusInput } from "@digico/api";
import { Save, XCircle, Clock, CheckCircle } from "lucide-react";
import { orderStatusCapabilities } from "@digico/contracts";

interface OrderDrawerActionBarProps {
  order: OrderDetail;
  editableItemsLength: number;
  isSaving: boolean;
  onSaveEdits: () => void;
  onSetStatus: (status: SetOrderStatusInput["status"], reason?: string) => void;
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
  const canChangeStatus = orderStatusCapabilities[order.status].canChangeStatus;
  return (
    <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSaveEdits} disabled={isSaving}>
          <Save className="w-4 h-4" /> Save Edits
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Cancel Button */}
        {canChangeStatus && (
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
        {canChangeStatus && order.status !== "on_hold" && (
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
        {canChangeStatus && order.status !== "processing" && (
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

        {/* Move to Pending Review Button */}
        {canChangeStatus && order.status !== "pending_review" && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSetStatus("pending_review", "Order moved to pending review")}
            disabled={isSaving}
          >
            <Clock className="w-4 h-4" /> Move to Pending Review
          </Button>
        )}

        {/* Mark as Completed Button */}
        {canChangeStatus && (
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
        {canChangeStatus && (
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
