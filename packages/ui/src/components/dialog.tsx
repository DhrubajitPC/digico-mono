import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";
import { useFocusTrap } from "../lib/use-focus-trap.js";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
}: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useFocusTrap(open, panelRef);

  if (!open) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs animate-in fade-in-0">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative w-full rounded-xl bg-white p-6 shadow-2xl transition-all border border-gray-100 focus:outline-none",
          maxWidthClass,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
        {title && <h2 className="text-xl font-bold text-gray-900 pr-10">{title}</h2>}
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
