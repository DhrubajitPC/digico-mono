import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { StatusBadge, type OrderStatusType } from "@digico/design-system";
import { cn } from "../lib/utils.js";

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
  disabled?: boolean;
}

export function OrderStatusDropDown({
  status,
  onStatusChange,
  disabled = false,
}: OrderStatusDropDownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  /*
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  /*
   * Close dropdown with Escape
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  /*
   * Select new status
   */
  const handleSelect = async (newStatus: OrderStatusType) => {
    // Don't do anything if selecting current status
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSaving(true);

      await onStatusChange(newStatus);

      setIsOpen(false);
    } catch (error) {
      console.error("Failed to change order status:", error);
    } finally {
      setIsSaving(false);
    }
  };

  /*
   * Toggle dropdown
   */
  const handleToggle = () => {
    if (disabled || isSaving) return;

    setIsOpen((previous) => !previous);
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      {/* Status Trigger */}
      <button
        type="button"
        disabled={disabled || isSaving}
        onClick={handleToggle}
        className={cn(
          "inline-flex items-center gap-1 rounded-full",
          "cursor-pointer border-0 bg-transparent p-0",
          "transition-all duration-150",
          "hover:opacity-90",
          (disabled || isSaving) && "cursor-not-allowed opacity-60",
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <StatusBadge status={status} />

        {!disabled && (
          <ChevronDown
            className={cn(
              "size-3 text-gray-400 transition-transform duration-150",
              isOpen && "rotate-180",
              isSaving && "animate-pulse",
            )}
          />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          className={cn(
            "absolute left-0 top-full z-[9999] mt-1",
            "min-w-[180px]",
            "rounded-lg border border-gray-200",
            "bg-white p-1",
            "shadow-lg",
          )}
          role="listbox"
          aria-label="Order status"
        >
          {statusOptions.map((option) => {
            const isActive = option === status;

            return (
              <button
                key={option}
                type="button"
                disabled={isSaving}
                onClick={() => handleSelect(option)}
                className={cn(
                  "flex w-full items-center justify-between",
                  "rounded-md px-3 py-2",
                  "text-left text-sm",
                  "transition-colors",
                  "hover:bg-gray-50",
                  isActive && "bg-blue-50",
                  isSaving && "cursor-not-allowed opacity-50",
                )}
                role="option"
                aria-selected={isActive}
              >
                <StatusBadge status={option} className="border-none bg-transparent px-0" />

                {isActive && <Check className="size-4 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
