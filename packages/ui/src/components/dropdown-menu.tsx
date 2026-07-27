import * as React from "react";
import { cn } from "../lib/utils.js";

export interface DropdownMenuItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "success" | "warning";
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  onSelect: (value: string) => void;
  className?: string;
}

export function DropdownMenu({ trigger, items, onSelect, className }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 mt-2 w-56 rounded-md bg-white p-1 shadow-lg ring-1 ring-black/5 focus:outline-none border border-gray-100 animate-in fade-in-0 zoom-in-95",
            className,
          )}
        >
          {items.map((item) => {
            const variantClass =
              item.variant === "destructive"
                ? "text-red-600 hover:bg-red-50"
                : item.variant === "success"
                  ? "text-emerald-700 hover:bg-emerald-50"
                  : item.variant === "warning"
                    ? "text-amber-700 hover:bg-amber-50"
                    : "text-gray-700 hover:bg-gray-100";

            return (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-base transition-colors text-left cursor-pointer",
                  variantClass,
                )}
                onClick={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
