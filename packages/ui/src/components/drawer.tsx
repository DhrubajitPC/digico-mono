import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";
import { useFocusTrap } from "../lib/use-focus-trap.js";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  width?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
}

export function Drawer({ open, onClose, title, subtitle, children, width = "3xl" }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useFocusTrap(open, panelRef);

  if (!open) return null;

  const widthClass = {
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
  }[width];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs">
      <div className="absolute inset-0 overflow-hidden">
        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={cn(
              "pointer-events-auto relative w-screen bg-white shadow-2xl flex flex-col border-l border-gray-200 focus:outline-none",
              widthClass,
            )}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50/50">
              <div>
                {title && <h2 className="text-xl font-bold text-gray-900">{title}</h2>}
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative flex-1 overflow-y-auto p-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
