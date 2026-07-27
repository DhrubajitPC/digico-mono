import * as React from "react";
import { cn } from "../lib/utils.js";

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <div className={cn("w-full", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            activeValue: value,
            onValueChange,
          });
        }
        return child;
      })}
    </div>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  activeValue?: string;
  onValueChange?: (value: string) => void;
}

export function TabsList({
  className,
  children,
  activeValue,
  onValueChange,
  ...props
}: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500",
        className,
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            activeValue,
            onValueChange,
          });
        }
        return child;
      })}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  activeValue?: string;
  onValueChange?: (value: string) => void;
}

export function TabsTrigger({
  value,
  activeValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const isSelected = activeValue === value;
  return (
    <button
      type="button"
      onClick={() => onValueChange?.(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        isSelected
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
