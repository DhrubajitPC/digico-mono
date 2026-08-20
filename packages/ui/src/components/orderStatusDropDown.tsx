import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Root, Trigger, Portal, Content, Item } from "@radix-ui/react-dropdown-menu";
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
  const [isOpen, setIsOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  /*
   * Close dropdown when clicking outside & Close dropdown with Escape
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, setIsOpen]);

  /*
   * Select new status
   */
  const handleSelect = async (newStatus: OrderStatusType) => {
    // Don't do anything if selecting current status
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }
    await onStatusChange(newStatus);
    setIsOpen(false);
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
        <Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onClick={(event) => {
            event.stopPropagation();
          }}
          className="z-50 min-w-[140px] rounded-md border border-gray-200 bg-white p-1 shadow-lg"
        >
          {statusOptions.map((statusOption) => (
            <Item
              key={statusOption}
              onSelect={(event) => {
                event.preventDefault();
                void handleSelect(statusOption);
              }}
              className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100"
            >
              <StatusBadge status={statusOption} />

              {statusOption === status && <Check size={14} className="ml-2 text-blue-600" />}
            </Item>
          ))}
        </Content>
      </Portal>
    </Root>
  );
}
