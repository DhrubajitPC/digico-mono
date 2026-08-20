import { Check, ChevronDown } from "lucide-react";

import { Root, Trigger, Portal, Content } from "@radix-ui/react-dropdown-menu";

import {
  Root as RadioGroup,
  Item as RadioItem,
  Indicator as ItemIndicator,
} from "@radix-ui/react-radio-group";

import { StatusBadge, type OrderStatusType } from "./status-badge.js";

const statusOptions: OrderStatusType[] = [
  "draft",
  "pending_review",
  "confirmed",
  "on_hold",
  "processing",
  "completed",
  "cancelled",
];

interface OrderStatusDropDownProps {
  status: OrderStatusType;
  onStatusChange: (newStatus: OrderStatusType) => void | Promise<void>;
  isSaving: boolean;
  disabled?: boolean;
}

export function OrderStatusDropDown({
  status,
  onStatusChange,
  isSaving,
  disabled = false,
}: OrderStatusDropDownProps) {
  /*
   * Select new status
   */
  const handleSelect = async (newStatus: OrderStatusType) => {
    if (newStatus !== status) {
      await onStatusChange(newStatus);
    }
  };

  return (
    <Root>
      <Trigger asChild>
        <button
          type="button"
          disabled={disabled || isSaving}
          onClick={(event) => {
            event.stopPropagation();
          }}
          className="inline-flex items-center gap-1 rounded-md outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <StatusBadge status={status} />

          <ChevronDown size={14} className="text-gray-500" />
        </button>
      </Trigger>

      <Portal>
        <Content align="start" className="rounded-sm border border-gray-200 bg-white p-1 shadow-md">
          <RadioGroup
            value={status}
            onValueChange={(value) => {
              void handleSelect(value as OrderStatusType);
            }}
          >
            {statusOptions.map((statusOption) => (
              <RadioItem
                key={statusOption}
                value={statusOption}
                className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100"
              >
                <StatusBadge status={statusOption} />

                <ItemIndicator>
                  <Check size={14} className="ml-2 text-blue-600" />
                </ItemIndicator>
              </RadioItem>
            ))}
          </RadioGroup>
        </Content>
      </Portal>
    </Root>
  );
}
