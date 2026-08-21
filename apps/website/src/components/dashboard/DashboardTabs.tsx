import type { OrderCounts } from "@digico/api";
import type { OrderStatusType } from "@digico/contracts";

type TabId = "all" | OrderStatusType;

interface TabItem {
  id: TabId;
  label: string;
  count: number;
}

interface DashboardTabsProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  counts: Partial<OrderCounts>;
}

export function DashboardTabs({ activeTab, onTabChange, counts }: DashboardTabsProps) {
  const tabs: TabItem[] = [
    { id: "all", label: "All", count: counts["all"] ?? 0 },
    { id: "pending_review", label: "Pending Review", count: counts["pending_review"] ?? 0 },
    { id: "on_hold", label: "On-Hold", count: counts["on_hold"] ?? 0 },
    { id: "confirmed", label: "Confirmed", count: counts["confirmed"] ?? 0 },
    { id: "processing", label: "Processing", count: counts["processing"] ?? 0 },
    { id: "cancelled", label: "Cancelled", count: counts["cancelled"] ?? 0 },
    { id: "completed", label: "Completed", count: counts["completed"] ?? 0 },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-6 overflow-x-auto text-sm font-semibold">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`pb-3 px-1 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  isSelected ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
