import { ChevronDown, Code2 } from "lucide-react";

interface PayloadInspectorProps {
  payload: unknown;
  open: boolean;
  onToggle: () => void;
}

/** Collapsible view of the simulated Meta webhook JSON payload. */
export function PayloadInspector({ payload, open, onToggle }: PayloadInspectorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 hover:text-emerald-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-indigo-600" />
          Meta Webhook JSON Inspector
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
          <p className="text-gray-500 mb-2">
            Simulated Meta WhatsApp Cloud API Payload sent to{" "}
            <code className="bg-gray-100 text-pink-600 px-1 rounded">/webhook</code>:
          </p>
          <pre className="overflow-x-auto bg-slate-900 text-emerald-400 p-3 rounded-lg text-[11px] font-mono max-h-60 leading-relaxed">
            {payload
              ? JSON.stringify(payload, null, 2)
              : "// Click Send on any query to view the simulated Meta webhook JSON payload"}
          </pre>
        </div>
      )}
    </div>
  );
}
