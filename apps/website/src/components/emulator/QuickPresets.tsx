import { ChevronRight, Zap } from "lucide-react";

const PRESET_QUERIES = [
  "Hi, I want to order 3x HP 15s laptops for my store",
  "What is the current stock and price of Samsung 24 inch monitor?",
  "Please check the status of my order #ORD-7585",
  "Can I order 5x Logitech MX Master mouse?",
];

interface QuickPresetsProps {
  disabled: boolean;
  onPresetQuery: (query: string) => void;
}

/** One-tap sample queries for the emulator testbench. */
export function QuickPresets({ disabled, onPresetQuery }: QuickPresetsProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        Quick Sample Queries
      </h3>
      <div className="space-y-2">
        {PRESET_QUERIES.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onPresetQuery(preset)}
            disabled={disabled}
            className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-emerald-50 hover:border-emerald-200 text-xs text-gray-700 hover:text-emerald-900 font-medium transition-all flex items-center justify-between group"
          >
            <span className="line-clamp-2">{preset}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 shrink-0 ml-2" />
          </button>
        ))}
      </div>
    </div>
  );
}
