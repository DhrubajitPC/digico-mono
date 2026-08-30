import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  StatusBadge,
} from "@digico/design-system";
import type { OrderStatusType } from "@digico/contracts";
import { orderStatusCapabilities } from "@digico/contracts";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

const statusOptions: OrderStatusType[] = [
  "draft",
  "pending_review",
  "confirmed",
  "on_hold",
  "processing",
  "completed",
  "cancelled",
];

interface OrderStatusDropdownProps {
  status: OrderStatusType;
  onStatusChange: (newStatus: OrderStatusType) => void | Promise<void>;
  isSaving: boolean;
  disabled?: boolean;
}

export function OrderStatusDropdown({
  status,
  onStatusChange,
  isSaving,
  disabled = false,
}: OrderStatusDropdownProps) {
  const handleSelect = async (newStatus: OrderStatusType) => {
    //
    if (newStatus === status) {
      return;
    }

    try {
      await onStatusChange(newStatus);

      toast.success(`Order status changed to ${newStatus.replace("_", " ")}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order status.");
    }
  };
  const canChangeStatus = orderStatusCapabilities[status].canChangeStatus;

  if (!canChangeStatus) {
    return <StatusBadge status={status} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled || isSaving} className="gap-1 rounded-sm">
        <StatusBadge status={status} />
        <ChevronDown size={14} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) => {
            void handleSelect(value as OrderStatusType);
          }}
        >
          {statusOptions.map((statusOption) => (
            <DropdownMenuRadioItem key={statusOption} value={statusOption}>
              <StatusBadge status={statusOption} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
