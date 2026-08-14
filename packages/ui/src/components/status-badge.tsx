import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export type OrderStatusType =
  | "draft"
  | "pending_review"
  | "confirmed"
  | "on_hold"
  | "processing"
  | "completed"
  | "cancelled";

const statusConfig: Record<
  OrderStatusType,
  { label: string; bg: string; text: string; dotBg: string }
> = {
  draft: {
    label: "Draft",
    bg: "bg-gray-100 border-gray-200",
    text: "text-gray-700",
    dotBg: "bg-gray-400",
  },
  pending_review: {
    label: "Pending Review",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    dotBg: "bg-amber-500",
  },
  confirmed: {
    label: "Confirmed",
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-800",
    dotBg: "bg-emerald-500",
  },
  on_hold: {
    label: "On-Hold",
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-800",
    dotBg: "bg-orange-500",
  },
  processing: {
    label: "Processing",
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    dotBg: "bg-blue-500",
  },
  completed: {
    label: "Completed",
    bg: "bg-teal-50 border-teal-200",
    text: "text-teal-800",
    dotBg: "bg-teal-600",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-rose-50 border-rose-200",
    text: "text-rose-800",
    dotBg: "bg-rose-500",
  },
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: OrderStatusType;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const normalizedStatus = (status in statusConfig ? status : "draft") as OrderStatusType;
  const config = statusConfig[normalizedStatus];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold transition-colors",
        config.bg,
        config.text,
        className,
      )}
      {...props}
    >
      <span className={cn("size-1.5 rounded-full", config.dotBg)} />
      {config.label}
    </span>
  );
}
