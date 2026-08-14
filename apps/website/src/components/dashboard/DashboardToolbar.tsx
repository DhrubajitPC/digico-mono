import { Button, Input, Select } from "@digico/design-system";
import type { OrderOriginType } from "@digico/contracts";
import { Search } from "lucide-react";

interface DashboardToolbarProps {
  bulkAction: string;
  onBulkActionChange: (action: string) => void;
  selectedOrderIdsCount: number;
  onApplyBulkAction: () => void;
  originFilter: OrderOriginType | "";
  onOriginFilterChange: (origin: OrderOriginType | "") => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export function DashboardToolbar({
  bulkAction,
  onBulkActionChange,
  selectedOrderIdsCount,
  onApplyBulkAction,
  originFilter,
  onOriginFilterChange,
  searchQuery,
  onSearchQueryChange,
}: DashboardToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        {/* Bulk Actions Dropdown */}
        <Select
          value={bulkAction}
          onChange={(e) => onBulkActionChange(e.target.value)}
          className="w-48 text-sm h-8"
        >
          <option value="">Bulk actions</option>
          <option value="processing">Change status to processing</option>
          <option value="on_hold">Change status to on-hold</option>
          <option value="completed">Change status to completed</option>
          <option value="cancelled">Change status to cancelled</option>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={onApplyBulkAction}
          disabled={!bulkAction || selectedOrderIdsCount === 0}
          className="h-8 text-sm"
        >
          Apply
        </Button>

        {/* Sales Channel Filter */}
        <Select
          value={originFilter}
          onChange={(e) => {
            const value = e.target.value;
            onOriginFilterChange(value === "whatsapp_ai" || value === "manual_sales" ? value : "");
          }}
          className="w-44 text-sm h-8"
        >
          <option value="">All sales channels</option>
          <option value="whatsapp_ai">WhatsApp AI</option>
          <option value="manual_sales">Direct Sales Rep</option>
        </Select>
      </div>

      {/* Search Input */}
      <div className="relative min-w-[240px]">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
        <Input
          type="text"
          placeholder="Search orders..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="pl-8 text-sm h-8 w-full"
        />
      </div>
    </div>
  );
}
