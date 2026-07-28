import { Send } from "lucide-react";
import type { Order } from "../../api.js";

interface WhatsAppPreviewBoxProps {
  origin: Order["origin"];
  proposedMsg: string;
  onProposedMsgChange: (msg: string) => void;
}

export function WhatsAppPreviewBox({
  origin,
  proposedMsg,
  onProposedMsgChange,
}: WhatsAppPreviewBoxProps) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50/40 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5 text-emerald-600" />
          {origin === "whatsapp_ai"
            ? "WhatsApp Confirmation Message Preview"
            : "Order Confirmation Note"}
        </label>
        <span className="text-xs text-emerald-700 font-medium">
          {origin === "whatsapp_ai"
            ? "Will be sent to dealer upon approval"
            : "Direct order summary note"}
        </span>
      </div>
      <textarea
        rows={3}
        value={proposedMsg}
        onChange={(e) => onProposedMsgChange(e.target.value)}
        className="w-full rounded-md border border-emerald-300 bg-white p-3 text-sm font-mono text-gray-800 focus:border-emerald-500 focus:outline-none shadow-xs"
      />
    </div>
  );
}
